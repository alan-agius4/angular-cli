/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Connect, ViteDevServer } from 'vite';
import { pathnameWithoutBasePath } from '../utils';

/**
 * Creates a middleware that strips the base path from the request URL.
 *
 * This middleware is inspired by Vite's internal base middleware and is used to ensure that
 * requests are correctly routed when a base path is configured, particularly in the context
 * of Angular's external SSR middleware.
 *
 * @see https://github.com/vitejs/vite/blob/d9ac20406cca3b32fc37c32a1c081881bf1ee897/packages/vite/src/node/server/middlewares/base.ts#L12
 *
 * @param server The Vite development server instance.
 * @returns A Connect middleware function.
 */
export function createAngularBaseMiddleware(server: ViteDevServer): Connect.NextHandleFunction {
  return function angularComponentMiddleware(req, _res, next) {
    const { base } = server.config;
    const { url } = req;

    if (url?.startsWith(base)) {
      const { search, hash } = new URL(url, 'http://localhost');
      req.url = [pathnameWithoutBasePath(url, server.config.base), search, hash].join('');
    }

    return next();
  };
}
