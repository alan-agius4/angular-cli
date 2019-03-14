/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as browserslist from 'browserslist';
import * as caniuse from 'caniuse-api';
import * as ts from 'typescript';

export function isDifferentialLoadingNeeded(
  projectRoot: string,
  target: ts.ScriptTarget): boolean {

  const supportES2015 = target !== ts.ScriptTarget.ES3 && target !== ts.ScriptTarget.ES5;
  const browsersList: string[] = browserslist(
    undefined, {
      path: projectRoot,
    });

  return supportES2015 && !caniuse.isSupported('es6-module', browsersList.join(', '));
}
