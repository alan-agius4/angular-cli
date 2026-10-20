/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import assert from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initializeHash } from '../../../utils/hash';
import { BundlerContext } from '../bundler-context';
import type { BundleStylesheetOptions } from '../stylesheets/bundle-options';
import { ComponentStylesheetBundler } from './component-stylesheets';

describe('ComponentStylesheetBundler', () => {
  let tempRoot: string;

  beforeAll(async () => {
    await initializeHash();
    const baseTmpDir = process.env['TEST_TMPDIR'];
    assert(baseTmpDir, 'TEST_TMPDIR is not set');
    tempRoot = await mkdtemp(join(baseTmpDir, 'angular-cli-component-stylesheets-'));
  });

  afterAll(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  function createOptions(
    overrides: Partial<BundleStylesheetOptions> = {},
  ): BundleStylesheetOptions {
    return {
      workspaceRoot: tempRoot,
      optimization: false,
      inlineFonts: false,
      sourcemap: false,
      outputNames: { bundles: '[name]', media: 'media/[name]' },
      target: ['es2022'],
      cacheOptions: {
        enabled: false,
        path: join(tempRoot, '.cache'),
        basePath: tempRoot,
      },
      ...overrides,
    };
  }

  it('should reuse inline BundlerContext when component file is invalidated with unchanged inline styles and invalidate watched dependencies', async () => {
    const sharedCssPath = join(tempRoot, 'shared.css');
    const compPath = join(tempRoot, 'comp.component.ts');
    await writeFile(sharedCssPath, '.shared { color: blue; }');

    const bundler = new ComponentStylesheetBundler(
      createOptions({ sourcemap: false }),
      'css',
      true,
    );
    const disposeSpy = spyOn(BundlerContext.prototype, 'dispose').and.callThrough();
    const invalidateSpy = spyOn(BundlerContext.prototype, 'invalidate').and.callThrough();
    const bundleSpy = spyOn(BundlerContext.prototype, 'bundle').and.callThrough();

    try {
      const inlineCss = `@import "./shared.css"; :host { display: block; }`;

      const initialResult = await bundler.bundleInline(inlineCss, compPath, 'css');
      expect(initialResult.contents).toContain('color: blue');
      const initialContext = bundleSpy.calls.mostRecent().object;

      // Invalidating the component .ts file should delegate to bundler.invalidate() without disposing the BundlerContext
      bundler.invalidate([compPath]);
      expect(disposeSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      // Rebuilding with unchanged inlineCss unmarks the entry as stale and reuses the same BundlerContext
      const rebuildUnchanged = await bundler.bundleInline(inlineCss, compPath, 'css');
      expect(rebuildUnchanged.contents).toContain('color: blue');
      expect(bundleSpy.calls.mostRecent().object).toBe(initialContext);

      // Subsequent invalidation should NOT evict the reused entry
      bundler.invalidate([compPath]);
      expect(disposeSpy).not.toHaveBeenCalled();
      await bundler.bundleInline(inlineCss, compPath, 'css');

      // Modifying and invalidating a watched dependency (@import "./shared.css") should invalidate the cached bundle result
      await writeFile(sharedCssPath, '.shared { color: green; }');
      bundler.invalidate([sharedCssPath]);
      expect(disposeSpy).not.toHaveBeenCalled();

      const rebuildAfterDepChange = await bundler.bundleInline(inlineCss, compPath, 'css');
      expect(rebuildAfterDepChange.contents).toContain('color: green');
      expect(bundleSpy.calls.mostRecent().object).toBe(initialContext);
    } finally {
      await bundler.dispose();
    }

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('should evict and dispose stale inline BundlerContext when component inline style content changes', async () => {
    const oldDepPath = join(tempRoot, 'old-dep.css');
    const newDepPath = join(tempRoot, 'new-dep.css');
    const compPath = join(tempRoot, 'changing.component.ts');
    await writeFile(oldDepPath, '.old { color: red; }');
    await writeFile(newDepPath, '.new { color: purple; }');

    const bundler = new ComponentStylesheetBundler(
      createOptions({ sourcemap: false }),
      'css',
      true,
    );
    const disposeSpy = spyOn(BundlerContext.prototype, 'dispose').and.callThrough();

    try {
      const oldCss = `@import "./old-dep.css"; :host { display: block; }`;
      const newCss = `@import "./new-dep.css"; :host { display: flex; }`;

      await bundler.bundleInline(oldCss, compPath, 'css');
      expect(bundler.collectReferencedFiles()).toContain(oldDepPath);

      // Component file is modified with new inline style content
      bundler.invalidate([compPath]);
      expect(disposeSpy).not.toHaveBeenCalled();

      await bundler.bundleInline(newCss, compPath, 'css');
      // Stale entry watchFiles should be excluded from collectReferencedFiles()
      expect(bundler.collectReferencedFiles()).toContain(newDepPath);
      expect(bundler.collectReferencedFiles()).not.toContain(oldDepPath);

      // Next invalidate cycle should dispose and evict the unused stale BundlerContext
      bundler.invalidate([compPath]);
      expect(disposeSpy).toHaveBeenCalledTimes(1);
    } finally {
      await bundler.dispose();
    }
  });
});
