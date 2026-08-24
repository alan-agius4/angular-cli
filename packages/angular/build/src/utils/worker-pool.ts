/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { getCompileCacheDir } from 'node:module';
import { Piscina } from 'piscina';

export type WorkerPoolOptions = ConstructorParameters<typeof Piscina>[0];

/**
 * Strips SSR and prerender in-memory loader hooks from Node.js execution arguments so
 * general-purpose worker threads do not unintentionally inherit module customization hooks.
 *
 * @param execArgv The list of Node.js execution arguments to sanitize.
 * @returns A new list of Node.js execution arguments without SSR loader hooks.
 */
export function sanitizeExecArgv(execArgv: readonly string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < execArgv.length; i++) {
    const arg = execArgv[i];
    if (
      arg.startsWith('--import=') &&
      (arg.includes('esm-in-memory-loader') || arg.includes('register-hooks'))
    ) {
      continue;
    }
    if (
      arg === '--import' &&
      i + 1 < execArgv.length &&
      (execArgv[i + 1].includes('esm-in-memory-loader') ||
        execArgv[i + 1].includes('register-hooks'))
    ) {
      i++; // Skip the import target as well
      continue;
    }
    result.push(arg);
  }

  return result;
}

export class WorkerPool extends Piscina {
  constructor(options: WorkerPoolOptions) {
    const piscinaOptions: WorkerPoolOptions = {
      minThreads: 1,
      idleTimeout: 4_000,
      // Web containers do not support transferable objects with receiveOnMessagePort which
      // is used when the Atomics based wait loop is enable.
      atomics: process.versions.webcontainer ? 'disabled' : 'sync',
      recordTiming: false,
      ...options,
    };

    // Filter out SSR in-memory loader hooks by default unless execArgv is explicitly provided
    if (options?.execArgv === undefined) {
      const sanitizedExecArgv = sanitizeExecArgv(process.execArgv);
      if (sanitizedExecArgv.length !== process.execArgv.length) {
        piscinaOptions.execArgv = sanitizedExecArgv;
      }
    }

    // Enable compile code caching if enabled for the main process (only exists on Node.js v22.8+).
    // Skip if running inside Bazel via a RUNFILES environment variable check. The cache does not work
    // well with Bazel's hermeticity requirements.
    const compileCacheDirectory = process.env['JS_BINARY__RUNFILES']
      ? undefined
      : getCompileCacheDir?.();
    if (compileCacheDirectory) {
      if (typeof piscinaOptions.env === 'object') {
        piscinaOptions.env['NODE_COMPILE_CACHE'] = compileCacheDirectory;
      } else {
        // Default behavior of `env` option is to copy current process values
        piscinaOptions.env = {
          ...process.env,
          'NODE_COMPILE_CACHE': compileCacheDirectory,
        };
      }
    }

    super(piscinaOptions);
  }
}
