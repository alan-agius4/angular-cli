/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

// CONSIDERATIONS
// For prod builds nitro needs the bundles and assets to be written to the disk to generate the manifest
// -- double read and writes of assets.
// How to configure `routeRules`

// TODO
// - app-shell
// - prerender redirect (static all)
// - double deps (esbuild/nitro)
// - manifest, how to? IE: do prerendered files.

// @ts-nocheck

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { BuildOutputFile, BuildOutputFileType } from '../esbuild/bundler-context';
import { BuildOutputAsset } from '../esbuild/bundler-execution-result';
import { createOutputFile } from '../esbuild/utils';
import { loadEsmModule } from '../../utils/load-esm';

export async function runNitro(
  outputFiles: any,
  externalPackages: boolean,
): Promise<Readonly<BuildOutputFile[]>> {
  const { build, copyPublicAssets, createNitro, prepare, prerender, writeTypes } =
    await loadEsmModule('nitropack');

  const virtualFiles: Record<string, string> = {};
  // for (const [path, { contents, type }] of outputFiles) {
  //   if (
  //     type !== bundler_context_1.BuildOutputFileType.ServerApplication &&
  //     type !== bundler_context_1.BuildOutputFileType.ServerRoot
  //   ) {
  //     continue;
  //   }
  //   virtualFiles[path] = new TextDecoder().decode(contents);
  // }

  // Create renderer
  virtualFiles['ng-renderder.mjs'] = `
    import { createError, eventHandler, toWebRequest } from 'h3';
    import { AngularAppEngine } from './dist/abc/server/server.mjs';

    const angularAppEngine = new AngularAppEngine();

    export default eventHandler(async (event) => {
      const html = await angularAppEngine.handle(toWebRequest(event));

      if (html === null) {
        throw createError({
          status: 400,
          statusMessage: "Bad Request",
          message: "No response",
        })
      }

      return html;
    });
  `;

  const nitro = await createNitro(
    {
      minify: false,
      sourceMap: false,
      dev: false,
      preset: externalPackages ? 'node' : 'node_server', //'cloudflare_worker',
      compatibilityDate: '2024-04-03',
      rollupConfig: {
        treeshake: !externalPackages,
        external: externalPackages ? (moduleId) => isExternalDependency(moduleId) : undefined,
        onwarn(warning, rollupWarn) {
          if (
            !['CIRCULAR_DEPENDENCY', 'EVAL', 'UNUSED_EXTERNAL_IMPORT'].includes(warning.code || '')
          ) {
            rollupWarn(warning);
          }
        },
      },
      publicAssets: [
        {
          baseURL: '',
          dir: 'dist/abc/browser',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
      ],
      prerender: {
        crawlLinks: false,
      },
      routeRules: {
        '**': { headers: { 'x-test': '1' } },
        '/home': { prerender: true },
      },
      virtual: virtualFiles,
      renderer: 'ng-renderder.mjs',
      // scanDirs: ['/ng-does-not-exist'],

      // Directories
      buildDir: '.angular/nitro',
      output: {
        dir: '.output',
        serverDir: '.output/server',
        publicDir: '.output/browser',
      },
    },
    {},
  );

  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    // await writeTypes(nitro);
    // Extract routes
    // Update routes config
    // nitro.updateConfig({ routeRules })
    await prerender(nitro);
    await build(nitro);

    // return [
    //   ...(await readFilesFromDirectory('.output/server', BuildOutputFileType.ServerRoot)),
    //   ...(await readFilesFromDirectory('.output/browser', BuildOutputFileType.Browser)),
    // ];
  } finally {
    await nitro.close();
  }
}

function isExternalDependency(moduleId: string): boolean {
  // more information about why we don't check for 'node_modules' path
  // https://github.com/rollup/rollup-plugin-node-resolve/issues/110#issuecomment-350353632
  if (moduleId[0] === '#' || moduleId[0] === '.' || moduleId.includes('nitro')) {
    // if it's either 'absolute', marked to embed, starts with a '.' or '/' or is the umd bundle and is tslib
    return false;
  }

  return true;
}

async function readFilesFromDirectory(
  dirPath: string,
  fileType: BuildOutputFileType,
): Promise<Readonly<BuildOutputFile[]>> {
  const output: BuildOutputFile[] = [];
  const files = await readdir(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = await stat(fullPath);
    if (stats.isFile()) {
      output.push(
        createOutputFile(
          fullPath.replace('.output/server/', '').replace('.output/browser/', ''),
          await readFile(fullPath, 'utf8'),
          fileType,
        ),
      );
    } else {
      const r = await readFilesFromDirectory(fullPath, fileType);
      output.push(...r);
    }
  }

  return output;
}
