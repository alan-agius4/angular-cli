/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as webpack from 'webpack';

export interface EmittedFiles {
  name?: string;
  file: string;
  extension: string;
}

export function getEmittedFiles(compilation: webpack.compilation.Compilation): EmittedFiles[] {
  const getExtension = (file: string) => file.split('.').reverse()[0];
  const files: EmittedFiles[] = [];

  for (const key of compilation.entrypoints.keys()) {
    const entrypoint = compilation.entrypoints.get(key);
    if (entrypoint && entrypoint.getFiles) {
      for (const file of entrypoint.getFiles()) {
        files.push({
          name: key as string,
          file,
          extension: getExtension(file),
        });
      }
    }
  }

  for (const file of Object.keys(compilation.assets)) {
    if (files.some(e => e.file === file)) {
      // skip as this already exists
      continue;
    }

    files.push({
      file,
      extension: getExtension(file),
    });
  }

  return files;
}
