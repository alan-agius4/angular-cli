/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Architect } from '@angular-devkit/architect/src/index';
import { normalize, virtualFs } from '@angular-devkit/core';
import { browserBuild, createArchitect, host } from '../utils';

// This feature is currently hidden behind a flag
xdescribe('Browser Builder with differential loading', () => {
  const target = { project: 'app', target: 'build' };
  let architect: Architect;

  beforeEach(async () => {
    await host.initialize().toPromise();
    architect = (await createArchitect(host.root())).architect;
  });

  afterEach(async () => {
    return host.restore().toPromise();
  });

  it('works', async () => {
    host.replaceInFile(
      'tsconfig.json',
      '"target": "es5"',
      '"target": "es2015"',
    );

    await browserBuild(architect, host, target);

    expect(await host.scopedSync().exists(normalize('dist/runtime-es5.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/main-es5.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/polyfills-es5.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/styles-es5.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/vendor-es5.js'))).toBe(true);

    expect(await host.scopedSync().exists(normalize('dist/runtime-es2015.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/main-es2015.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/polyfills-es2015.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/styles-es2015.js'))).toBe(true);
    expect(await host.scopedSync().exists(normalize('dist/vendor-es2015.js'))).toBe(true);

    expect(await host.scopedSync().exists(normalize('dist/favicon.ico'))).toBe(true);
  });

  it('emits the right es formats', async () => {
    host.replaceInFile(
      'tsconfig.json',
      '"target": "es5"',
      '"target": "es2015"',
    );

    await browserBuild(architect, host, target, { optimization: true });

    const mainEs5FileName = normalize('dist/main-es5.js');
    const mainEs2015FileName = normalize('dist/main-es2015.js');

    const contentEs5 =
      virtualFs.fileBufferToString(host.scopedSync().read(mainEs5FileName));

    const contentEs2015 =
      virtualFs.fileBufferToString(host.scopedSync().read(mainEs2015FileName));

    expect(contentEs5).not.toContain('class');
    expect(contentEs2015).toContain('class');

  });

});
