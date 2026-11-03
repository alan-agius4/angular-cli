The command can be used to build a project of type "application" or "library".
When used to build a library, a different builder is invoked, and only the `assets`, `clear-screen`, `configuration`, `delete-output-path`, `inline-style-language`, `output-path`, `poll`, `preserve-symlinks`, `progress`, `ts-config`, and `watch` options are shared with application builds.
The library builder also supports the library-specific `allowed-non-peer-dependencies`, `compilation-mode`, `declaration-map`, and `keep-lifecycle-scripts` options.
All other options apply only to building applications.

The application builder uses the [esbuild](https://esbuild.github.io/) build tool, with default configuration options specified in the workspace configuration file (`angular.json`) or with a named alternative configuration.
A "development" configuration is created by default when you use the CLI to create the project, and you can use that configuration by specifying the `--configuration development`.

The configuration options generally correspond to the command options.
You can override individual configuration defaults by specifying the corresponding options on the command line.
The command can accept option names given in dash-case.
Note that in the configuration file, you must specify names in camelCase.

Some additional options can only be set through the configuration file,
either by direct editing or with the `ng config` command.
These include `assets`, `styles`, and `scripts` objects that provide runtime-global resources to include in the project.
Resources in CSS, such as images and fonts, are automatically written to the `media` directory of the browser output
(configurable with the `outputPath.media` option) and fingerprinted when `outputHashing` is set to `all` or `media`.

For further details, see [Workspace Configuration](reference/configs/workspace-config).
