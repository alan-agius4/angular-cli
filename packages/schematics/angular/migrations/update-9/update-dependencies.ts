/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Tree } from '@angular-devkit/schematics';
import {
  NodeDependencyType,
  addPackageJsonDependency,
  getPackageJsonDependency,
  removePackageJsonDependency,
} from '../../utility/dependencies';
import { latestVersions } from '../../utility/latest-versions';

export function updateDependencies() {
  return (host: Tree) => {
    const dependenciesToUpdate: Record<string, string> = {
      '@angular/pwa': latestVersions.AngularPWA,
      '@angular-devkit/build-angular': latestVersions.DevkitBuildAngular,
      '@angular-devkit/build-ng-packagr': latestVersions.DevkitBuildNgPackagr,
      '@angular-devkit/build-webpack': latestVersions.DevkitBuildWebpack,
      'zone.js': latestVersions.ZoneJs,
      tsickle: latestVersions.tsickle,
      'ng-packagr': latestVersions.ngPackagr,
      'web-animations-js': '^2.3.2',
    };

    for (const [name, version] of Object.entries(dependenciesToUpdate)) {
      const current = getPackageJsonDependency(host, name);
      if (!current || current.version === version) {
        continue;
      }

      addPackageJsonDependency(host, {
        type: current.type,
        name,
        version,
        overwrite: true,
      });
    }

    // Remove tslib from devDependencies if exists.
    const currentTslib = getPackageJsonDependency(host, 'tslib');
    if (currentTslib && currentTslib.type !== NodeDependencyType.Default) {
      removePackageJsonDependency(host, 'tslib');
    }

    // In Angular 9, tslib is no longer include as a direct dependency of the FW.
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: 'tslib',
      version: latestVersions.TsLib,
      overwrite: true,
    });
  };
}
