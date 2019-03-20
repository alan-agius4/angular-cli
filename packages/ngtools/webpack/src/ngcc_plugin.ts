/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { hasBeenProcessed, process } from '@angular/compiler-cli/ngcc';
import { ResolvePlugin } from 'webpack';

interface NgccPluginOptions {
  mainFields: string[];
}

export class NgccPlugin implements ResolvePlugin {
  constructor(private options: NgccPluginOptions) { }

  apply(resolver: any) {
    resolver.getHook('before-existing-directory')
      .tap('NgccPlugin', (request: any, _resolveContext: any) => {
        // Only process packages
        if (request.path !== request.descriptionFileRoot) {
          return;
        }

        const packageJson = request.descriptionFileData;
        let entry = this.options.mainFields.find(mf => typeof packageJson[mf] === 'string');
        if (!entry) {
          return;
        }

        // Remove Ivy ngcc marker from main field name
        entry = entry.replace('_ivy_ngcc', '');

        if (hasBeenProcessed(packageJson, entry)) {
          // Skip this package if it has already been processed by NGCC.
          return;
        }

        process({
          basePath: request.path,
          propertiesToConsider: [entry],
          compileAllFormats: false,
          createNewEntryPointFormats: true,
        });

        return;
      });
  }
}
