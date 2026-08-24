/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { WorkerPool, sanitizeExecArgv } from './worker-pool';

describe('WorkerPool', () => {
  describe('sanitizeExecArgv', () => {
    it('should strip --import= flags referencing register-hooks', () => {
      const input = [
        '--enable-source-maps',
        '--import=file:///path/to/register-hooks.js',
        '--max-old-space-size=4096',
      ];
      const result = sanitizeExecArgv(input);

      expect(result).toEqual(['--enable-source-maps', '--max-old-space-size=4096']);
    });

    it('should strip --import= flags referencing esm-in-memory-loader', () => {
      const input = [
        '--import=file:///workspace/packages/angular/build/src/utils/server-rendering/esm-in-memory-loader/loader-hooks.js',
        '--trace-warnings',
      ];
      const result = sanitizeExecArgv(input);

      expect(result).toEqual(['--trace-warnings']);
    });

    it('should strip paired --import and path arguments for register-hooks', () => {
      const input = [
        '--trace-deprecation',
        '--import',
        'file:///path/to/register-hooks.js',
        '--expose-gc',
      ];
      const result = sanitizeExecArgv(input);

      expect(result).toEqual(['--trace-deprecation', '--expose-gc']);
    });

    it('should preserve unrelated --import flags', () => {
      const input = ['--import=tsx', '--import', 'custom-module'];
      const result = sanitizeExecArgv(input);

      expect(result).toEqual(['--import=tsx', '--import', 'custom-module']);
    });

    it('should return an empty array when given an empty array', () => {
      expect(sanitizeExecArgv([])).toEqual([]);
    });
  });

  describe('instance creation and defaults', () => {
    it('should sanitize execArgv by default when execArgv is not specified', async () => {
      const pool = new WorkerPool({
        filename: require.resolve('./hash'),
      });

      try {
        for (const arg of pool.options.execArgv ?? []) {
          expect(arg).not.toContain('register-hooks');
          expect(arg).not.toContain('esm-in-memory-loader');
        }
      } finally {
        await pool.destroy();
      }
    });

    it('should preserve explicit execArgv when provided in options', async () => {
      const customExecArgv = ['--import=file:///custom/register-hooks.js', '--enable-source-maps'];
      const pool = new WorkerPool({
        filename: require.resolve('./hash'),
        execArgv: customExecArgv,
      });

      try {
        expect(pool.options.execArgv).toEqual(customExecArgv);
      } finally {
        await pool.destroy();
      }
    });

    it('should use default pool configuration values', async () => {
      const pool = new WorkerPool({
        filename: require.resolve('./hash'),
      });

      try {
        expect(pool.options.minThreads).toBe(1);
        expect(pool.options.idleTimeout).toBe(4_000);
        expect(pool.options.recordTiming).toBe(false);
      } finally {
        await pool.destroy();
      }
    });

    it('should allow overriding default pool configuration values', async () => {
      const pool = new WorkerPool({
        filename: require.resolve('./hash'),
        minThreads: 2,
        maxThreads: 4,
        idleTimeout: 10_000,
      });

      try {
        expect(pool.options.minThreads).toBe(2);
        expect(pool.options.maxThreads).toBe(4);
        expect(pool.options.idleTimeout).toBe(10_000);
      } finally {
        await pool.destroy();
      }
    });
  });
});
