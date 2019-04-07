/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompiledFileType, generateIndexHtml } from './generate-index-html';

describe('generateIndexHtml', () => {

  it('can generate an index.html with module, and nomodule bundles', async () => {

    const source = await generateIndexHtml({
      input: 'index.html',
      inputContent: '<html><head></head><body></body></html>',
      baseHref: '/',
      sri: false,
      loadOutputFile: (fileName: string) => Promise.resolve(''),
      unfilteredUnsortedFiles: [
        {file: 'a.js', type: 'module' as CompiledFileType, entry: 'a'},
        {file: 'b.js', type: 'nomodule' as CompiledFileType, entry: 'b'},
        {file: 'c.js', type: 'none' as CompiledFileType, entry: 'c'},
      ],
      entryPoints: ['a', 'b', 'c'],
      noModuleFiles: new Set<string>(),
    });

    const html = source.source();

    expect(html).toContain('<script src="a.js" type="module"></script>');
    expect(html).toContain('<script src="b.js" nomodule></script>');
    expect(html).toContain('<script src="c.js"></script>');

  });

});
