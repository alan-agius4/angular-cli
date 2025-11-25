/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Connect, Plugin } from 'vite';
import {
  ComponentStyleRecord,
  angularHtmlFallbackMiddleware,
  createAngularAssetsMiddleware,
  createAngularBaseMiddleware,
  createAngularComponentMiddleware,
  createAngularHeadersMiddleware,
  createAngularIndexHtmlMiddleware,
  createAngularSsrExternalMiddleware,
  createAngularSsrInternalMiddleware,
  createChromeDevtoolsMiddleware,
} from '../middlewares';
import { AngularMemoryOutputFiles, AngularOutputAssets } from '../utils';

export enum ServerSsrMode {
  /**
   * No SSR
   */
  NoSsr,

  /**
   * Internal server-side rendering (SSR) is handled through the built-in middleware.
   *
   * In this mode, the SSR process is managed internally by the dev-server's middleware.
   * The server automatically renders pages on the server without requiring external
   * middleware or additional configuration from the developer.
   */
  InternalSsrMiddleware,

  /**
   * External server-side rendering (SSR) is handled by a custom middleware defined in server.ts.
   *
   * This mode allows developers to define custom SSR behavior by providing a middleware in the
   * `server.ts` file. It gives more flexibility for handling SSR, such as integrating with other
   * frameworks or customizing the rendering pipeline.
   */
  ExternalSsrMiddleware,
}

interface AngularSetupMiddlewaresPluginOptions {
  outputFiles: AngularMemoryOutputFiles;
  assets: AngularOutputAssets;
  extensionMiddleware?: Connect.NextHandleFunction[];
  indexHtmlTransformer?: (content: string) => Promise<string>;
  componentStyles: Map<string, ComponentStyleRecord>;
  templateUpdates: Map<string, string>;
  ssrMode: ServerSsrMode;
  resetComponentUpdates: () => void;
  projectRoot: string;
}

async function createEncapsulateStyle(): Promise<
  (style: Uint8Array, componentId: string) => string
> {
  const { encapsulateStyle } = await import('@angular/compiler');
  const decoder = new TextDecoder('utf-8');

  return (style, componentId) => encapsulateStyle(decoder.decode(style), componentId);
}

export function createAngularSetupMiddlewaresPlugin(
  options: AngularSetupMiddlewaresPluginOptions,
): Plugin {
  return {
    name: 'vite:angular-setup-middlewares',
    enforce: 'pre',
    async configureServer(server) {
      const {
        indexHtmlTransformer,
        outputFiles,
        extensionMiddleware,
        assets,
        componentStyles,
        templateUpdates,
        ssrMode,
        resetComponentUpdates,
      } = options;

      const { middlewares } = server;

      // Headers, assets and resources get handled first
      middlewares
        .use(createAngularHeadersMiddleware(server))
        .use(createAngularComponentMiddleware(server, templateUpdates))
        .use(
          createAngularAssetsMiddleware(
            server,
            assets,
            outputFiles,
            componentStyles,
            await createEncapsulateStyle(),
          ),
        )
        .use(createChromeDevtoolsMiddleware(server.config.cacheDir, options.projectRoot));

      extensionMiddleware?.forEach((middleware) => middlewares.use(middleware));

      // Returning a function, installs middleware after the main transform middleware but
      // before the built-in HTML middleware
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      return async () => {
        if (ssrMode === ServerSsrMode.ExternalSsrMiddleware) {
          removeMiddleware(middlewares, 'viteBaseMiddleware');
          middlewares
            .use(createAngularBaseMiddleware(server))
            .use(await createAngularSsrExternalMiddleware(server, indexHtmlTransformer));

          return;
        }

        if (ssrMode === ServerSsrMode.InternalSsrMiddleware) {
          middlewares.use(createAngularSsrInternalMiddleware(server, indexHtmlTransformer));
        }

        middlewares
          .use(angularHtmlFallbackMiddleware)
          .use(
            createAngularIndexHtmlMiddleware(
              server,
              outputFiles,
              resetComponentUpdates,
              indexHtmlTransformer,
            ),
          );
      };
    },
  };
}

/**
 * Removes a middleware from the Vite server's middleware stack by its name.
 *
 * @param middlewares The Connect server instance.
 * @param name The name of the middleware to remove.
 */
function removeMiddleware(middlewares: Connect.Server, name: string): void {
  const index = middlewares.stack.findIndex(
    ({ handle }) => typeof handle === 'function' && handle.name === name,
  );

  if (index >= 0) {
    middlewares.stack.splice(index, 1);
  }
}
