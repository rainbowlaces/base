## Base – Architecture Overview

Minimal TypeScript foundation + CLI for building modular Node / browser packages with consistent tooling. This repo currently ships two packages:

1. `@rainbowlaces/base` (packages/base) – core runtime, utilities, build + lint config, scaffolding templates.
2. `create-base` (packages/create-base) – lightweight CLI to scaffold a new project pre‑wired with the same patterns.

### High‑Level Goals
- Small, composable core (no heavy framework lock‑in)
- Predictable build (esbuild) + fast test feedback
- Opinionated linting / formatting via shared ESLint config
- Clear separation between core types, feature modules, and utilities
- Scaffolding to keep new packages consistent

### Repo Layout
```
packages/
	base/               # Main library + CLI commands
		src/
			core/           # Core abstractions (base types, errors, foundational logic)
			modules/        # Optional / pluggable feature modules
			utils/          # Reusable helpers (pure, side‑effect free where possible)
			index.ts        # Public entrypoint (exports curated surface)
		bin/cli.js        # Executable shim; subcommands in bin/commands
		bin/commands/     # build | lint | start | init | ping | format-log
		scaffold/         # Project + TS + ESLint template files
		eslint-rules/     # Custom ESLint rules (e.g. no-self-referential-config)
		test/             # Unit + integration tests mirroring src layout
		testApp/          # Lightweight example / manual test harness
	create-base/        # `npx create-base` scaffolder (invokes templates)
```

### Build + Tooling
- Bundler: `esbuild` (config in `esbuild.config.js`) – fast ESM/CJS outputs (release config variant in `tsconfig.release.json`).
- TypeScript: Layered `tsconfig.*` for base, client, and release builds.
- Linting: Central ESLint config (`eslint.config.js`) + custom rule directory.
- Scripts (pnpm): build, test, lint, start dev server (see package.json for exact names).
- Tests: Located under `test/` mirroring `src/`, plus shared helpers in `test/testUtils/`.

### Runtime Architecture
Core concepts:
- Core layer (`core/`): foundational types (`types.ts`), shared error classes (`baseErrors.ts`), and the main orchestrator (`base.ts`). This layer should remain stable and dependency‑light.
- Modules (`modules/`): optional capabilities that extend the core without bloating the base. Designed for tree‑shaking.
- Utilities (`utils/`): pure helpers; side effects avoided to keep them easily testable.
- CLI: Thin command wrappers delegating logic to library functions (keeps commands declarative / testable).

### Extensibility
- Add new feature: create a folder in `src/modules/<feature>` exposing a clear public API; export selectively through `src/index.ts`.
- Custom ESLint rules live beside config to encourage consistent code quality across downstream repos.
- Scaffolding templates guarantee new projects start with the same TS + lint + module layout.

### Error Handling
- Centralized error types under `core/baseErrors.ts` to provide consistent error shapes and future mapping/log formatting.
- CLI commands format errors via shared log utilities (e.g. `format-log` command) for consistent DX.

### Testing Approach
- Mirror structure: `test/<area>/` matches `src/<area>/` for discoverability.
- Utility + core tests focus on pure logic. CLI / integration tests can use the `testApp` sandbox.

### Quick Start
```bash
pnpm install
pnpm build        # Type check + build outputs
pnpm test         # Run all tests (fast)
pnpm start:dev    # If provided: run a dev harness / test app
```

### Release Philosophy
- Keep surface small; promote composition over large monolith exports.
- Favor incremental, well‑typed APIs; breaking changes gated behind major version bumps.

### Coming Soon
Full documentation (detailed API reference, module authoring guide, CLI extension patterns) will land in the next doc sprint. For now this overview should be enough to navigate and extend the codebase.

---
Questions / gaps? Open an issue or leave a TODO in code with a concise rationale.
