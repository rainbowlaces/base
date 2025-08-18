# create-base

Scaffolding CLI to generate a new project preconfigured with `@rainbowlaces/base` tooling (TypeScript, ESLint, templates, module layout).

## Usage
```bash
npx create-base my-app
cd my-app
pnpm install
pnpm build
pnpm test
```

## What You Get
- TS configs (base + client)
- ESLint config + custom rule support
- Sample module (`HelloModule`)
- Client loader + entrypoint
- Scripts for build, test, lint, start

## Options (basic)
Currently minimal; pass the target directory name. Future flags (planned): template selection, skip-install, module presets.

## Relation to @rainbowlaces/base
This just copies templates from `packages/base/scaffold` and does light post-processing. Use it to keep new repos consistent.

## License
MIT
