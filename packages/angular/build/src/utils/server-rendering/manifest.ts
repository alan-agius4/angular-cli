/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Metafile } from 'esbuild';
import { extname } from 'node:path';
import {
  NormalizedApplicationBuildOptions,
  getLocaleBaseHref,
} from '../../builders/application/options';
import { type BuildOutputFile, BuildOutputFileType } from '../../tools/esbuild/bundler-context';
import { createOutputFile } from '../../tools/esbuild/utils';
import { shouldOptimizeChunks } from '../environment-options';

export const SERVER_APP_MANIFEST_FILENAME = 'angular-app-manifest.mjs';
export const SERVER_APP_ENGINE_MANIFEST_FILENAME = 'angular-app-engine-manifest.mjs';

interface FilesMapping {
  path: string;
  dynamicImport: boolean;
}

const MAIN_SERVER_OUTPUT_FILENAME = 'main.server.mjs';

/**
 * A mapping of unsafe characters to their escaped Unicode equivalents.
 */
const UNSAFE_CHAR_MAP: Record<string, string> = {
  '`': '\\`',
  '$': '\\$',
  '\\': '\\\\',
};

/**
 * Escapes unsafe characters in a given string by replacing them with
 * their Unicode escape sequences.
 *
 * @param str - The string to be escaped.
 * @returns The escaped string where unsafe characters are replaced.
 */
function escapeUnsafeChars(str: string): string {
  return str.replace(/[$`\\]/g, (c) => UNSAFE_CHAR_MAP[c]);
}

/**
 * Generates the server manifest for the App Engine environment.
 *
 * This manifest is used to configure the server-side rendering (SSR) setup for the
 * Angular application when deployed to Google App Engine. It includes the entry points
 * for different locales and the base HREF for the application.
 *
 * @param i18nOptions - The internationalization options for the application build. This
 * includes settings for inlining locales and determining the output structure.
 * @param baseHref - The base HREF for the application. This is used to set the base URL
 * for all relative URLs in the application.
 */
export function generateAngularServerAppEngineManifest(
  i18nOptions: NormalizedApplicationBuildOptions['i18nOptions'],
  baseHref: string | undefined,
): string {
  const entryPointsContent: string[] = [];

  if (i18nOptions.shouldInline) {
    for (const locale of i18nOptions.inlineLocales) {
      const importPath =
        './' + (i18nOptions.flatOutput ? '' : locale + '/') + MAIN_SERVER_OUTPUT_FILENAME;

      let localeWithBaseHref = getLocaleBaseHref('', i18nOptions, locale) || '/';

      // Remove leading and trailing slashes.
      const start = localeWithBaseHref[0] === '/' ? 1 : 0;
      const end = localeWithBaseHref[localeWithBaseHref.length - 1] === '/' ? -1 : undefined;
      localeWithBaseHref = localeWithBaseHref.slice(start, end);

      entryPointsContent.push(`['${localeWithBaseHref}', () => import('${importPath}')]`);
    }
  } else {
    entryPointsContent.push(`['', () => import('./${MAIN_SERVER_OUTPUT_FILENAME}')]`);
  }

  const manifestContent = `
export default {
  basePath: '${baseHref ?? '/'}',
  entryPoints: new Map([${entryPointsContent.join(', \n')}]),
};
  `;

  return manifestContent;
}

/**
 * Generates the server manifest for the standard Node.js environment.
 *
 * This manifest is used to configure the server-side rendering (SSR) setup for the
 * Angular application when running in a standard Node.js environment. It includes
 * information about the bootstrap module, whether to inline critical CSS, and any
 * additional HTML and CSS output files.
 *
 * @param additionalHtmlOutputFiles - A map of additional HTML output files generated
 * during the build process, keyed by their file paths.
 * @param outputFiles - An array of all output files from the build process, including
 * JavaScript and CSS files.
 * @param inlineCriticalCss - A boolean indicating whether critical CSS should be inlined
 * in the server-side rendered pages.
 * @param routes - An optional array of route definitions for the application, used for
 * server-side rendering and routing.
 * @param locale - An optional string representing the locale or language code to be used for
 * the application, helping with localization and rendering content specific to the locale.
 * @param initialFiles - A list of initial files that preload tags have already been added for.
 * @param metafile - An esbuild metafile object.
 * @param publicPath - The configured public path.
 *
 * @returns An object containing:
 * - `manifestContent`: A string of the SSR manifest content.
 * - `serverAssetsChunks`: An array of build output files containing the generated assets for the server.
 */
export function generateAngularServerAppManifest(
  additionalHtmlOutputFiles: Map<string, BuildOutputFile>,
  outputFiles: BuildOutputFile[],
  inlineCriticalCss: boolean,
  routes: readonly unknown[] | undefined,
  locale: string | undefined,
  initialFiles: Set<string>,
  metafile: Metafile,
  publicPath: string | undefined,
): {
  manifestContent: string;
  serverAssetsChunks: BuildOutputFile[];
} {
  const serverAssetsChunks: BuildOutputFile[] = [];
  const serverAssetsContent: string[] = [];
  for (const file of [...additionalHtmlOutputFiles.values(), ...outputFiles]) {
    const extension = extname(file.path);
    if (extension === '.html' || (inlineCriticalCss && extension === '.css')) {
      const jsChunkFilePath = `assets-chunks/${file.path.replace(/[./]/g, '_')}.mjs`;
      serverAssetsChunks.push(
        createOutputFile(
          jsChunkFilePath,
          `export default \`${escapeUnsafeChars(file.text)}\`;`,
          BuildOutputFileType.ServerApplication,
        ),
      );

      serverAssetsContent.push(
        `['${file.path}', {size: ${file.size}, hash: '${file.hash}', text: () => import('./${jsChunkFilePath}').then(m => m.default)}]`,
      );
    }
  }

  // When routes have been extracted, mappings are no longer needed, as preloads will be included in the metadata.
  // When shouldOptimizeChunks is enabled the metadata is no longer correct and thus we cannot generate the mappings.
  const serverToBrowserMappings =
    routes?.length || shouldOptimizeChunks
      ? undefined
      : generateLazyLoadedFilesMappings(metafile, initialFiles, publicPath);

  const manifestContent = `
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: ${inlineCriticalCss},
  locale: ${JSON.stringify(locale, undefined, 2)},
  serverToBrowserMappings: ${JSON.stringify(serverToBrowserMappings, undefined, 2)},
  routes: ${JSON.stringify(routes, undefined, 2)},
  assets: new Map([\n${serverAssetsContent.join(', \n')}\n]),
};
`;

  return { manifestContent, serverAssetsChunks };
}

/**
 * Generates a mapping of lazy-loaded files from a given metafile.
 *
 * This function processes the outputs of a metafile to create a mapping
 * between MJS files (server bundles) and their corresponding JS files
 * that should be lazily loaded. It filters out files that do not have
 * an entry point, do not export any modules, or are not of the
 * appropriate file extensions (.js or .mjs).
 *
 * @param metafile - An object containing metadata about the output files,
 * including entry points, exports, and imports.
 * @param initialFiles - A set of initial file names that are considered
 * already loaded and should be excluded from the mapping.
 * @param publicPath - The configured public path.
 *
 * @returns A record where the keys are MJS file names (server bundles) and
 * the values are arrays of corresponding JS file names (browser bundles).
 */
function generateLazyLoadedFilesMappings(
  metafile: Metafile,
  initialFiles: Set<string>,
  publicPath = '',
): Record<string, FilesMapping[]> {
  const entryPointToBundles = new Map<
    string,
    { js: FilesMapping[] | undefined; mjs: string | undefined }
  >();

  for (const [fileName, { entryPoint, exports, imports }] of Object.entries(metafile.outputs)) {
    const extension = extname(fileName);

    // Skip files that don't have an entryPoint, no exports, or are not .js or .mjs
    if (!entryPoint || exports?.length < 1 || (extension !== '.js' && extension !== '.mjs')) {
      continue;
    }

    const data = entryPointToBundles.get(entryPoint) ?? { js: undefined, mjs: undefined };
    if (extension === '.js') {
      const importedPaths: FilesMapping[] = [
        {
          path: `${publicPath}${fileName}`,
          dynamicImport: false,
        },
      ];

      for (const { kind, external, path } of imports) {
        if (
          external ||
          initialFiles.has(path) ||
          (kind !== 'dynamic-import' && kind !== 'import-statement')
        ) {
          continue;
        }

        importedPaths.push({
          path: `${publicPath}${path}`,
          dynamicImport: kind === 'dynamic-import',
        });
      }

      data.js = importedPaths;
    } else {
      data.mjs = fileName;
    }

    entryPointToBundles.set(entryPoint, data);
  }

  const bundlesReverseLookup: Record<string, FilesMapping[]> = {};
  // Populate resultedLookup with mjs as key and js as value
  for (const { js, mjs } of entryPointToBundles.values()) {
    if (mjs && js?.length) {
      bundlesReverseLookup[mjs] = js;
    }
  }

  return bundlesReverseLookup;
}
