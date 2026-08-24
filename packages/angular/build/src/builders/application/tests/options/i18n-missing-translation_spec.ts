/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { buildApplication } from '../../index';
import { APPLICATION_BUILDER_INFO, BASE_OPTIONS, describeBuilder, expectNoLog } from '../setup';

describeBuilder(buildApplication, APPLICATION_BUILDER_INFO, (harness) => {
  describe('Option: "i18nMissingTranslation"', () => {
    beforeEach(() => {
      harness.useProject('test', {
        root: '.',
        sourceRoot: 'src',
        cli: {
          cache: {
            enabled: false,
          },
        },
        i18n: {
          locales: {
            'fr': 'src/locales/messages.fr.xlf',
          },
        },
      });
    });

    it('should warn when i18nMissingTranslation is undefined (default)', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        i18nMissingTranslation: undefined,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', MISSING_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expect(logs).toContain(
        jasmine.objectContaining({
          level: 'warn',
          message: jasmine.stringMatching('No translation found for'),
        }),
      );
    });

    it('should warn when i18nMissingTranslation is set to warning', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i18nMissingTranslation: 'warning' as any,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', MISSING_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expect(logs).toContain(
        jasmine.objectContaining({
          level: 'warn',
          message: jasmine.stringMatching('No translation found for'),
        }),
      );
    });

    it('should error when i18nMissingTranslation is set to error', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i18nMissingTranslation: 'error' as any,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', MISSING_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeFalse();
      expect(logs).toContain(
        jasmine.objectContaining({
          level: 'error',
          message: jasmine.stringMatching('No translation found for'),
        }),
      );
    });

    it('should not error or warn when i18nMissingTranslation is set to ignore', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i18nMissingTranslation: 'ignore' as any,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', MISSING_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expectNoLog(logs, 'No translation found for');
    });

    it('should not error or warn when i18nMissingTranslation is set to error and all found', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i18nMissingTranslation: 'error' as any,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', GOOD_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expectNoLog(logs, 'No translation found for');
    });

    it('should not error or warn when i18nMissingTranslation is set to warning and all found', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i18nMissingTranslation: 'warning' as any,
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', GOOD_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expectNoLog(logs, 'No translation found for');
    });
    it('should build multiple locales in parallel and output translated files per locale', async () => {
      harness.useProject('test', {
        root: '.',
        sourceRoot: 'src',
        cli: {
          cache: {
            enabled: false,
          },
        },
        i18n: {
          sourceLocale: 'en-US',
          locales: {
            'fr': 'src/locales/messages.fr.xlf',
            'de': 'src/locales/messages.de.xlf',
          },
        },
      });

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        localize: ['fr', 'de'],
      });

      await harness.writeFile(
        'src/app/app.component.html',
        `
          <p id="hello" i18n="An introduction header for this sample">Hello {{ title }}! </p>
        `,
      );

      await harness.writeFile('src/locales/messages.fr.xlf', GOOD_TRANSLATION_FILE_CONTENT);
      await harness.writeFile('src/locales/messages.de.xlf', GERMAN_TRANSLATION_FILE_CONTENT);

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBeTrue();
      expectNoLog(logs, 'No translation found for');

      harness.expectFile('dist/browser/fr/main.js').content.toContain('Bonjour');
      harness.expectFile('dist/browser/de/main.js').content.toContain('Hallo');
      harness.expectFile('dist/browser/fr/index.html').content.toContain('lang="fr"');
      harness.expectFile('dist/browser/de/index.html').content.toContain('lang="de"');
    });
  });
});

const GOOD_TRANSLATION_FILE_CONTENT = `
  <?xml version="1.0" encoding="UTF-8" ?>
  <xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file target-language="fr" datatype="plaintext" original="ng2.template">
      <body>
        <trans-unit id="4286451273117902052" datatype="html">
          <target>Bonjour <x id="INTERPOLATION" equiv-text="{{ title }}"/>! </target>
          <context-group purpose="location">
            <context context-type="targetfile">src/app/app.component.html</context>
            <context context-type="linenumber">2,3</context>
          </context-group>
          <note priority="1" from="description">An introduction header for this sample</note>
        </trans-unit>
      </body>
    </file>
  </xliff>
`;

const MISSING_TRANSLATION_FILE_CONTENT = `
  <?xml version="1.0" encoding="UTF-8" ?>
  <xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file target-language="fr" datatype="plaintext" original="ng2.template">
      <body>

      </body>
    </file>
  </xliff>
`;

const GERMAN_TRANSLATION_FILE_CONTENT = `
  <?xml version="1.0" encoding="UTF-8" ?>
  <xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file target-language="de" datatype="plaintext" original="ng2.template">
      <body>
        <trans-unit id="4286451273117902052" datatype="html">
          <target>Hallo <x id="INTERPOLATION" equiv-text="{{ title }}"/>! </target>
          <context-group purpose="location">
            <context context-type="targetfile">src/app/app.component.html</context>
            <context context-type="linenumber">2,3</context>
          </context-group>
          <note priority="1" from="description">An introduction header for this sample</note>
        </trans-unit>
      </body>
    </file>
  </xliff>
`;
