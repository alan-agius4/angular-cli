/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as path from 'path';
import { ScriptTarget } from 'typescript';
import {
  isDifferentialLoadingNeeded,
} from './utils';

const devkitRoot = (global as any)._DevKitRoot; // tslint:disable-line:no-any
const workspaceRoot = path.join(
  devkitRoot,
  'tests/angular_devkit/build_angular/test-differential-loading/');

const browserslistPathIeOnly = path.join(workspaceRoot, 'browserslist-ie-only');
const browserslistPathChromeOnly = path.join(workspaceRoot, 'browserslist-chrome-only');

describe('differential loading', () => {

  it('detects the need for differential loading for IE 9-11 and ES2015', () => {
    const needed = isDifferentialLoadingNeeded(workspaceRoot, ScriptTarget.ES2015);
    expect(needed).toBe(true);
  });

  it('detects no need for differential loading for Chrome and ES2015', () => {
    const needed = isDifferentialLoadingNeeded(
      browserslistPathChromeOnly,
      ScriptTarget.ES2015);

    expect(needed).toBe(false);
  });

  it('detects no need for differential loading for target is ES5', () => {
    const needed = isDifferentialLoadingNeeded(
      browserslistPathIeOnly,
      ScriptTarget.ES5);

    expect(needed).toBe(false);
  });
});
