# The Base Framework

A modern TypeScript-first application framework with a simple module system, dependency injection, structured logging, pub/sub, and a batteries-included CLI for building HTTP services and more.

This README documents the current HEAD of the repository, which will be released as version 3.15.0. The currently published version on npm may lag behind; check release notes upon upgrade.

- Package: @rainbowlaces/base
- Node.js: >= 24
- Repo: rainbowlaces/base (monorepo; this is the core package)
- CLI: base

Contents:
- Why Base
- Prerequisites
- Quick Start (Zero to Hello World)
- Project Layout (what init creates)
- Development Workflow (start, build, test, lint)
- CLI Reference (init, start, build, lint, format-log, ping)
- Core Concepts (Modules and DI, Request handling, Pub/Sub, Logging, Config, Client bundle)
- Troubleshooting & FAQ

Why Base
- Simplicity first: drop in Base.start(import.meta.url), create a module, add a route decorator, and go.
- Convention over configuration: opinionated file structure and defaults via base init.
- Robust tooling: type-checking, esbuild-powered builds, CLI for dev/start, lint integration, and log formatter for readable dev output.
- Extensible core: dependency injection, pub/sub, structured logs, templates, and configurable build.

Prerequisites
- Node.js 24 or newer
- npm (or pnpm/yarn if preferred)
- A new or existing TypeScript project directory

Quick Start (Zero to Hello World)
1) Scaffold a new project
- Create an empty folder, then run:
  - npm init @rainbowlaces/base
- This command uses the initializer package to run base init under the hood and scaffold a working project with sensible defaults.

Useful options:
- --force overwrite existing files if present
- --client include a client setup (tsconfig.client.json + src/client/loader.ts)
- --no-mod-example skip the example HelloModule
- --no-install do not install peer dev dependencies

2) Explore what was created
- tsconfig.json: TypeScript config for server code
- eslint.config.js: ESLint config wired for the Base workflow
- base.config.js: Build configuration used by base build
- .gitignore: sensible defaults
- src/index.ts: application entrypoint
- src/modules/HelloModule.ts: example module (unless you used --no-mod-example)
- Optional client scaffold:
  - tsconfig.client.json
  - src/client/loader.ts

3) Run the app (development)
- npm run start:dev
- This runs type-aware builds under the hood and launches your app with DevTools inspector and pretty log formatting.

4) Hello World example
If you allowed the example module, you’ll already have a Hello World:
- src/index.ts
  import { Base } from '@rainbowlaces/base';
  Base.start(import.meta.url);
- src/modules/HelloModule.ts
  import { BaseModule, request, baseModule } from '@rainbowlaces/base';

  @baseModule()
  export class HelloModule extends BaseModule {
    @request('/get/hello')
    async hello({ context }) {
      context.res.json({ message: 'Hello World' });
    }
  }

What’s happening?
- Base.start(import.meta.url) bootstraps Base with your project root.
- @baseModule registers a singleton module with DI and marks it for setup/teardown in the correct phase.
- @request('/get/hello') declares an HTTP handler; Base wires it so requests to /get/hello respond with JSON.

Project Layout (what init creates)
- base.config.js: central build configuration
- tsconfig.json: server TypeScript config
- eslint.config.js: ESLint config for linting TypeScript in src
- .gitignore
- src/
  - index.ts: bootstrap calling Base.start(import.meta.url)
  - modules/
    - HelloModule.ts: minimal example of @baseModule and @request
  - client/ (optional if you pass --client)
    - loader.ts: client entry
- tsconfig.client.json (optional when --client)

Development Workflow
Scripts added by base init will be injected or preserved in your package.json. The key ones are:
- start: npx base start
- start:dev: npx base build --no-types && npx base start -q --dev
- build: npm run lint && npx base build -q
- build:acr: npx base build --no-types
- tsc: npx base build --types-only
- tsc:watch: npx nodemon --watch src --ext ts --exec 'npm run tsc'
- start:dev:watch: npx nodemon --watch src --ext ts,css --exec 'npm run start:dev'
- lint: npx base lint
- lint:fix: npm run lint -- --fix
- lint:watch: npx nodemon --watch src --ext ts --exec 'npm run lint'
- build:watch: npx nodemon --watch src --ext ts --exec 'npm run build'
- test: npx base build --test && node --enable-source-maps --test --test-reporter=dot '_test/test/**/*.js'

Typical loop:
- npm run start:dev to develop with inspector and pretty logs
- Edit files in src/, add modules in src/modules/, and routes using @request
- npm run build for a full type-checked build
- npm test to build test bundles and run Node’s built-in test runner
- npm run lint or npm run lint:fix to keep code clean

CLI Reference
The Base CLI is available via npx base or as scripts via npm run.

Global flags:
- -q, --quiet suppress header output
- -e, --errors only show errors
- -s, --silent totally silent

Commands:
- base init [options]
  Scaffold a new Base project (files + scripts + peer dev deps).
  Options:
  - --force overwrite existing files
  - --client include client scaffold
  - --no-mod-example skip HelloModule example
  - --no-install skip installing peer dev dependencies (typescript, eslint, nodemon, esbuild)
  Behavior:
  - Writes/updates tsconfig.json, eslint.config.js, base.config.js, .gitignore, src/index.ts
  - Optionally creates src/modules/HelloModule.ts and client files
  - Adds/merges scripts into package.json
  - Installs missing dev dependencies unless --no-install

- base start [entryFile] [--dev]
  Runs a pre-built JavaScript entry (does not build).
  - entryFile: absolute or relative to project root. Default: dist/src/index.js
  - --dev: run with inspector and route logs through the formatter for readable dev output
  Notes:
  - In dev mode, both stdout and stderr are merged and piped through base format-log
  - Graceful shutdown is supported; SIGINT and friends are handled to allow the app to cleanup

- base build [--release] [--types-only] [--test] [--no-types]
  Type-checks with tsc, then builds JS with esbuild.
  - --release: release build; generates declaration files
  - --types-only: only run type-checking for entire project
  - --test: build source and test files for the built-in Node test runner
  - --no-types: skip type-checking during the main build
  Behavior:
  - Cleans dist, type-checks (server and client if configured), then builds bundles based on base.config.js
  - For developer experience when working on this framework itself, the CLI handles a testApp, but for consumer apps you only get what you need

- base lint [paths...] [--fix]
  Lints your project using the Base ESLint configuration.
  - If no paths provided, uses config-aware defaults and excludes client code when appropriate
  - --fix applies fixable rules

- base format-log
  Reads newline-delimited JSON logs from stdin and formats them for humans.
  - Useful in dev pipelines; base start --dev uses it automatically

- base ping
  A simple health/CLI connectivity check. Useful to confirm the CLI is wired.

Core Concepts
- Bootstrap: Base.start(import.meta.url)
  - import.meta.url lets Base resolve your project root; from there, Base initializes DI, module discovery, and autoloads your code.

- Modules and DI
  - @baseModule registers a class with the DI container as a singleton module with lifecycle hooks (setup/teardown) and a phase (default 100, must be > 50 because core phases occupy lower numbers).
  - dependsOn decorator is available for module dependency ordering when needed.
  - Modules extend BaseModule and can define actions (methods) that are invoked by the framework.

- Request handling
  - Use @request(topicOrOptions) on methods of a @baseModule class to define HTTP handlers.
  - When passed a string, it registers a route like /get/hello. Internally Base composes topics as /request/:requestId/* to route requests through the context execution bus.
  - Default middleware behavior: if no topic is specified, middleware defaults to true (global handler). For explicit routes, middleware defaults to false unless you opt in.
  - Handlers receive an args object with context; reply with context.res.json(...), etc.

- Pub/Sub
  - Base includes a pub/sub system. Internally, @request wires a subscription to /context/execute/<Module>/<action> to invoke your action method with the current request context.
  - You can publish/subscribe to your own topics for decoupled communication inside your app.

- Logging
  - Structured logs are emitted; base format-log turns newline-delimited JSON logs into readable output with timestamp, levels, namespace, tags, and context payload.
  - In development, start:dev routes logs through the formatter automatically.

- Config and Build
  - base.config.js defines server/client entry points, assets, ignore patterns, and other build aspects.
  - base build validates your config and builds server and, if configured, client assets using esbuild.

- Client bundle (optional)
  - If you scaffold with --client, you’ll get tsconfig.client.json and a client entry at src/client/loader.ts.
  - The build will optionally produce a client bundle and copy static assets into dist based on base.config.js.

Troubleshooting & FAQ
- Node version errors or syntax issues at runtime
  - Ensure you are running Node.js 24 or newer.

- My Hello route doesn’t respond
  - Confirm your module is decorated with @baseModule and your method with @request('/get/hello').
  - Ensure you ran npm run build (or npm run start:dev which builds and starts in dev mode).

- Logs look like raw JSON in dev
  - Use npm run start:dev (or base start -q --dev) so logs flow through base format-log automatically.

- Lint complaints about files in client
  - The CLI’s lint command reads base.config.js and intelligently excludes client code when appropriate. You can also pass explicit paths to lint if desired.

Notes on Versioning
- This README targets the upcoming 3.15.0 release (current HEAD). Some APIs and scaffolding may differ slightly from 3.14.x. Review the changelog when upgrading.
