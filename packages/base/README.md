# @rainbowlaces/base

Minimal, modular TypeScript foundation + CLI for building Node + browser services.

## Features
- Lightweight core (config, DI, modules, request handling, logging)
- Built‑in modules: static assets, templates, devtools
- Custom decorators for config, DI, modules, requests
- Structured logger with redaction + serialization
- Scaffolding templates for new projects
- Fast build (esbuild) + full test suite

## Install
```bash
pnpm add @rainbowlaces/base
```

## Quick Start
```ts
import { Base, baseModule } from '@rainbowlaces/base';

@baseModule()
class AppModule {}

async function main() {
  const app = new Base({ modules: [AppModule] });
  await app.start();
}
main();
```

## CLI (via bin/cli.js)
```bash
npx base init my-app    # scaffold project
npx base build          # build
npx base lint           # lint
npx base start          # start dev/test app
```

## Concepts
- Core: types + lifecycle orchestration
- Modules: pluggable features
- Config: class/decorator driven configuration registry
- DI: decorator-driven dependency graph
- Request Handler: HTTP/WebSocket routing + context phases
- Logger: redactors + serializers for safe logs

## Extending
Add a module under `src/modules/YourModule` and export through `src/index.ts`.

## License
MIT
