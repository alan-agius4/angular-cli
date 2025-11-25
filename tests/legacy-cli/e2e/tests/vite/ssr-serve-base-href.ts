import assert from 'node:assert';
import { writeMultipleFiles } from '../../utils/fs';
import { ng, silentNg } from '../../utils/process';
import { installWorkspacePackages, uninstallPackage } from '../../utils/packages';
import { ngServe, updateJsonFile, useSha } from '../../utils/project';
import { getGlobalVariable } from '../../utils/env';

export default async function () {
  assert(
    getGlobalVariable('argv')['esbuild'],
    'This test should not be called in the Webpack suite.',
  );

  // Forcibly remove in case another test doesn't clean itself up.
  await uninstallPackage('@angular/ssr');
  await ng('add', '@angular/ssr', '--skip-confirmation', '--skip-install');
  await useSha();
  await installWorkspacePackages();
  await updateJsonFile('angular.json', (workspaceJson) => {
    workspaceJson.projects['test-project'].architect.build.options.baseHref = '/base/';
  });

  await writeMultipleFiles({
    'src/app/app.routes.ts': `
      import { Routes } from '@angular/router';
      import { Home } from './home/home';

      export const routes: Routes = [
        { path: 'home', component: Home }
      ];
    `,
    'src/server.ts': `
      import { AngularNodeAppEngine, writeResponseToNodeResponse, isMainModule, createNodeRequestHandler } from '@angular/ssr/node';
      import express from 'express';
      import { join } from 'node:path';

      export function app(): express.Express {
        const server = express();
        const browserDistFolder = join(import.meta.dirname, '../browser');
        const angularNodeAppEngine = new AngularNodeAppEngine();

        server.use('/api/{*splat}', (req, res) => {
          res.json({ hello: 'foo' })
        });

        server.use(express.static(browserDistFolder, {
          maxAge: '1y',
          index: 'index.html'
        }));

        server.use(async(req, res, next) => {
          const response = await angularNodeAppEngine.handle(req);
          if (response) {
            writeResponseToNodeResponse(response, res);
          } else {
            next();
          }
        });

        return server;
      }

      const server = app();
      export const reqHandler = createNodeRequestHandler(server);
  `,
  });

  await silentNg('generate', 'component', 'home');

  const port = await ngServe();

  await validateResponse('/base/main.js', /bootstrapApplication/);
  await validateResponse('/base/home', /home works/);
  await validateResponse('/api/test', /foo/);

  await validateResponse('/base/api/test', /Cannot Get/, 404);
  await validateResponse('/home', /Cannot Get/, 404);
  await validateResponse('/main.js', /Cannot Get/, 404);

  async function validateResponse(pathname: string, match: RegExp, status = 200): Promise<void> {
    const response = await fetch(new URL(pathname, `http://localhost:${port}`));
    const text = await response.text();
    assert.match(text, match);
    assert.equal(response.status, status);
  }
}
