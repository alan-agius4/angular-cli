/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { createHash } from 'crypto';
import {
  RawSource,
  ReplaceSource,
  Source,
} from 'webpack-sources';

const parse5 = require('parse5');

export type LoadOutputFileFunctionType = (file: string) => Promise<string>;

export interface GenerateIndexHtmlParams {
  // input file name (e. g. index.html)
  input: string;
  // contents of input
  inputContent: string;
  baseHref?: string;
  deployUrl?: string;
  sri: boolean;
  // the files emitted by the build
  unfilteredUnsortedFiles: CompiledFileInfo[];
  // list with entry points in the order we need to reference their bundles
  entryPoints: string[];
  // additional files that should be added using nomodule
  noModuleFiles?: Set<string>;
  // function that loads a file
  // This allows us to use different routines within the IndexHtmlWebpackPlugin and
  // when used without this plugin.
  loadOutputFile: LoadOutputFileFunctionType;
}

/*
 * Defines the type of script tag that is generated for the script reference
 * nomodule: <script src="..." nomodule></script>
 * module: <script src="..." type="module"></script>
 * none: <script src="..."></script>
 */
export type CompiledFileType = 'nomodule' | 'module' | 'none';

export interface CompiledFileInfo {
  file: string;
  type: CompiledFileType;

  // the webpack entry point of this file is needed for sorting
  entry: string;
}

// sorts the past unsortedFiles according to its entry points
export function sortFilesByEntryPoints(
  unsortedFiles: CompiledFileInfo[],
  sortedEntryPoints: string[]): CompiledFileInfo[] {

  const entryToFilesMap = new Map<string, CompiledFileInfo[]>();
  const result: CompiledFileInfo[] = [];

  unsortedFiles.forEach(file => {
    const files = entryToFilesMap.get(file.entry) || [];
    entryToFilesMap.set(file.entry, [...files, file]);
  });

  sortedEntryPoints.forEach(entry => {
    const files = entryToFilesMap.get(entry) || [];
    result.push(...files);
  });

  return result;
}

/*
 * Helper function used by the IndexHtmlWebpackPlugin.
 * Can also be directly used by builder, e. g. in order to generate an index.html
 * after processing several configurations in order to build different sets of
 * bundles for differential serving.
 */
export async function generateIndexHtml(params: GenerateIndexHtmlParams): Promise<Source> {

  const loadOutputFile = params.loadOutputFile;

  // Filter files
  const existingFiles = new Set<string>();
  const stylesheets: string[] = [];
  const scripts: string[] = [];

  // bring files in the right order, e. g. put polyfills first
  const unfilteredSortedFiles = sortFilesByEntryPoints(
    params.unfilteredUnsortedFiles,
    params.entryPoints);

  const moduleFilesArray = unfilteredSortedFiles
    .filter(f => f.type === 'module')
    .map(f => f.file);

  const moduleFiles = new Set<string>(moduleFilesArray);

  const noModuleFilesArray = unfilteredSortedFiles
    .filter(f => f.type === 'nomodule')
    .map(f => f.file);

  const noneFilesArray = unfilteredSortedFiles
    .filter(f => f.type === 'none')
    .map(f => f.file);

  const fileNames = [...moduleFilesArray, ...noModuleFilesArray, ...noneFilesArray];

  const noModuleFiles = new Set<string>(noModuleFilesArray);

  for (const file of fileNames) {

    if (existingFiles.has(file)) {
      continue;
    }
    existingFiles.add(file);

    if (file.endsWith('.js')) {
      scripts.push(file);
    } else if (file.endsWith('.css')) {
      stylesheets.push(file);
    }
  }

  // Find the head and body elements
  const treeAdapter = parse5.treeAdapters.default;
  const document = parse5.parse(params.inputContent, { treeAdapter, locationInfo: true });
  let headElement;
  let bodyElement;
  for (const docChild of document.childNodes) {
    if (docChild.tagName === 'html') {
      for (const htmlChild of docChild.childNodes) {
        if (htmlChild.tagName === 'head') {
          headElement = htmlChild;
        }
        if (htmlChild.tagName === 'body') {
          bodyElement = htmlChild;
        }
      }
    }
  }

  if (!headElement || !bodyElement) {
    throw new Error('Missing head and/or body elements');
  }

  // Determine script insertion point
  let scriptInsertionPoint;
  if (bodyElement.__location && bodyElement.__location.endTag) {
    scriptInsertionPoint = bodyElement.__location.endTag.startOffset;
  } else {
    // Less accurate fallback
    // parse5 4.x does not provide locations if malformed html is present
    scriptInsertionPoint = params.inputContent.indexOf('</body>');
  }

  let styleInsertionPoint;
  if (headElement.__location && headElement.__location.endTag) {
    styleInsertionPoint = headElement.__location.endTag.startOffset;
  } else {
    // Less accurate fallback
    // parse5 4.x does not provide locations if malformed html is present
    styleInsertionPoint = params.inputContent.indexOf('</head>');
  }

  // Inject into the html
  const indexSource = new ReplaceSource(new RawSource(params.inputContent), params.input);

  // this is for files that are configured to get the nomodule
  // attribute too, like polyfills.es5
  // When not using differential loading it's part of the
  // none files below and it needs to keep its position
  // within the none-files (below runtime.js).
  const configuredNoModuleFiles = params.noModuleFiles;
  let scriptElements = '';
  for (const script of scripts) {
    const attrs: { name: string, value: string | null }[] = [
      { name: 'src', value: (params.deployUrl || '') + script },
    ];

    if (noModuleFiles.has(script) || (
      configuredNoModuleFiles && configuredNoModuleFiles.has(script)
    )) {
      attrs.push({ name: 'nomodule', value: null });
    }

    if (moduleFiles.has(script)) {
      attrs.push({ name: 'type', value: 'module' });
    }

    if (params.sri) {
      const content = await loadOutputFile(script);
      attrs.push(..._generateSriAttributes(content));
    }

    const attributes = attrs
      .map(attr => attr.value === null ? attr.name : `${attr.name}="${attr.value}"`)
      .join(' ');
    scriptElements += `<script ${attributes}></script>`;
  }

  indexSource.insert(
    scriptInsertionPoint,
    scriptElements,
  );

  // Adjust base href if specified
  if (typeof params.baseHref == 'string') {
    let baseElement;
    for (const headChild of headElement.childNodes) {
      if (headChild.tagName === 'base') {
        baseElement = headChild;
      }
    }

    const baseFragment = treeAdapter.createDocumentFragment();

    if (!baseElement) {
      baseElement = treeAdapter.createElement(
        'base',
        undefined,
        [
          { name: 'href', value: params.baseHref },
        ],
      );

      treeAdapter.appendChild(baseFragment, baseElement);
      indexSource.insert(
        headElement.__location.startTag.endOffset,
        parse5.serialize(baseFragment, { treeAdapter }),
      );
    } else {
      let hrefAttribute;
      for (const attribute of baseElement.attrs) {
        if (attribute.name === 'href') {
          hrefAttribute = attribute;
        }
      }
      if (hrefAttribute) {
        hrefAttribute.value = params.baseHref;
      } else {
        baseElement.attrs.push({ name: 'href', value: params.baseHref });
      }

      treeAdapter.appendChild(baseFragment, baseElement);
      indexSource.replace(
        baseElement.__location.startOffset,
        baseElement.__location.endOffset,
        parse5.serialize(baseFragment, { treeAdapter }),
      );
    }
  }

  const styleElements = treeAdapter.createDocumentFragment();
  for (const stylesheet of stylesheets) {
    const attrs = [
      { name: 'rel', value: 'stylesheet' },
      { name: 'href', value: (params.deployUrl || '') + stylesheet },
    ];

    if (params.sri) {
      const content = await loadOutputFile(stylesheet);
      attrs.push(..._generateSriAttributes(content));
    }

    const element = treeAdapter.createElement('link', undefined, attrs);
    treeAdapter.appendChild(styleElements, element);
  }

  indexSource.insert(
    styleInsertionPoint,
    parse5.serialize(styleElements, { treeAdapter }),
  );

  return indexSource;
}

function _generateSriAttributes(content: string) {
  const algo = 'sha384';
  const hash = createHash(algo)
    .update(content, 'utf8')
    .digest('base64');

  return [
    { name: 'integrity', value: `${algo}-${hash}` },
    { name: 'crossorigin', value: 'anonymous' },
  ];
}
