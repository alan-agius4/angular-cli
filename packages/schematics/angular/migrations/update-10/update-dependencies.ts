/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  addPackageJsonDependency,
  getPackageJsonDependency,
} from '../../utility/dependencies';
import { latestVersions } from '../../utility/latest-versions';

export default function (): Rule {
  return (host, context) => {
    let hasChanges = false;
    const dependenciesToUpdate: Record<string, string> = {
      'karma': '~5.0.0',
      'karma-jasmine': '~3.3.0',
      'protractor': '~7.0.0',
      'ng-packagr': latestVersions.ngPackagr,
      'tslib': '^2.0.0',
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

      hasChanges = true;
    }

    if (hasChanges) {
      context.addTask(new NodePackageInstallTask());
    }

    // Check for @angular-devkit/schematics and @angular-devkit/core
    for (const name of ['@angular-devkit/schematics', '@angular-devkit/core']) {
      const current = getPackageJsonDependency(host, name);
      if (current) {
        context.logger.info(
          `Package "${name}" found in the workspace package.json. ` +
            'This package typically does not need to be installed manually. ' +
            'If it is not being used by project code, it can be removed from the package.json.',
        );
      }
    }
  };
}
