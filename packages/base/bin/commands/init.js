import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCAFFOLD_ROOT = path.resolve(__dirname, "..", "..", "scaffold");

function readScaffold(rel) {
  const full = path.join(SCAFFOLD_ROOT, rel);
  if (!fs.existsSync(full))
    throw new Error(`Scaffold template missing: ${rel}`);
  return fs.readFileSync(full, "utf8");
}

const FILES = {
  tsconfig: () => readScaffold("tsconfig.template.json"),
  tsconfigClient: () => readScaffold("tsconfig.client.template.json"),
  baseConfig: () => readScaffold("base.config.template.js"),
  eslint: () => readScaffold("eslint.config.template.js"),
  gitignore: () => readScaffold(".gitignore.template"),
  index: () => readScaffold("src/index.ts"),
  helloModule: () => readScaffold("src/modules/HelloModule.ts"),
  clientLoader: () => readScaffold("src/client/loader.ts"),
};

function writeFile(targetPath, contents, { force, quietLog }) {
  if (fs.existsSync(targetPath) && !force) {
    quietLog(
      `⚠️  Skipping existing file: ${path.relative(process.cwd(), targetPath)}`
    );
    return false;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents, "utf8");
  quietLog(`✅ Wrote ${path.relative(process.cwd(), targetPath)}`);
  return true;
}

export function createInitCommand(program) {
  program
    .command("init")
    .argument('[targetDir]', 'Directory to create / use (defaults to current working directory)')
  .description("Scaffold a new Base project (files + scripts + peers). Client scaffold included by default.")
  .option("--force", "Overwrite existing files")
  .option("--no-client", "Skip client scaffold (omit tsconfig.client.json + client/loader.ts)")
    .option("--no-mod-example", "Skip HelloModule example")
    .option(
      "--no-install",
      "Skip installing peer dev dependencies (typescript, eslint, nodemon, esbuild)"
    )
    .action(async (targetDir, options) => {
      // Determine target project root: create if user supplied a relative/absolute path
      let projectRoot = program.paths.projectRoot; // default (current resolved root)
      if (targetDir) {
        const provided = path.resolve(process.cwd(), targetDir);
        try {
          if (!fs.existsSync(provided)) {
            fs.mkdirSync(provided, { recursive: true });
          }
          projectRoot = provided;
        } catch (err) {
          program.quietError(`❌ Unable to prepare target directory: ${provided}`);
          program.quietError(err?.message || String(err));
          process.exit(1);
        }
      }
      const { quietLog, quietError } = program;

      try {
  quietLog(`🛠  Initialising Base project scaffold in: ${projectRoot}`);
  const force = !!options.force;
  // client scaffold now default ON; Commander sets options.client === false when --no-client used
  const addClient = options.client !== false;

        const created = [];
        const skipped = [];

        function attempt(name, rel, contentFn) {
          const target = path.join(projectRoot, rel);
          const ok = writeFile(target, contentFn(), { force, quietLog });
          (ok ? created : skipped).push(rel);
        }

        // create core files
        attempt("tsconfig", "tsconfig.json", FILES.tsconfig);
        attempt("eslint", "eslint.config.js", FILES.eslint);
        attempt("base.config", "base.config.js", FILES.baseConfig);
        attempt("gitignore", ".gitignore", FILES.gitignore);
        attempt("index", "src/index.ts", FILES.index);
        if (!options.noModExample)
          attempt(
            "helloModule",
            "src/modules/HelloModule.ts",
            FILES.helloModule
          );

        if (addClient) {
          attempt(
            "tsconfigClient",
            "tsconfig.client.json",
            FILES.tsconfigClient
          );
          attempt("clientLoader", "src/client/loader.ts", FILES.clientLoader);
        } else {
          // Replace base.config.js with server-only config (remove client stanza)
          try {
            const serverOnly = `// Framework build configuration (server only)\nexport default {\n  server: { ignore: ['src/client/**'] }\n};\n`;
            const cfgPath = path.join(projectRoot, 'base.config.js');
            fs.writeFileSync(cfgPath, serverOnly, 'utf8');
            quietLog('✅ Adjusted base.config.js for server-only (no client)');
          } catch (e) {
            quietError('⚠️ Failed to adjust base.config.js for server-only mode', e?.message || e);
          }
        }

        // --- package.json scripts + peer deps ---
        const pkgPath = path.join(projectRoot, "package.json");
        let pkgChanged = false;
        let pkg;
        if (fs.existsSync(pkgPath)) {
          try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          } catch {
            pkg = {};
          }
        } else {
          pkg = { name: path.basename(projectRoot), version: "0.1.0" };
          pkgChanged = true;
        }
        pkg.type = pkg.type || "module";
        const defaultScripts = {
          start: "npx base start",
          test: "npx base build --test && node --enable-source-maps --test --test-reporter=dot '_test/test/**/*.js'",
          "start:dev": "npx base build --no-types && npx base start -q --dev",
          lint: "npx base lint",
          "lint:fix": "npm run lint -- --fix",
          tsc: "npx base build --types-only",
          build: "npm run lint && npx base build -q",
          "build:acr": "npx base build --no-types",
          "tsc:watch": "npx nodemon --watch src --ext ts --exec 'npm run tsc'",
          "start:dev:watch":
            "npx nodemon --watch src --ext ts,css --exec 'npm run start:dev'",
          "lint:watch":
            "npx nodemon --watch src --ext ts --exec 'npm run lint'",
          "build:watch":
            "npx nodemon --watch src --ext ts --exec 'npm run build'",
        };
        pkg.scripts = pkg.scripts || {};
        const addedScripts = [];
        const skippedScripts = [];
        for (const [k, v] of Object.entries(defaultScripts)) {
          if (pkg.scripts[k]) {
            skippedScripts.push(k);
            continue;
          }
          pkg.scripts[k] = v;
          addedScripts.push(k);
          pkgChanged = true;
        }
        if (pkgChanged) {
          fs.writeFileSync(
            pkgPath,
            JSON.stringify(pkg, null, 2) + "\n",
            "utf8"
          );
          quietLog(
            `✅ Updated package.json (added scripts: ${
              addedScripts.length ? addedScripts.join(", ") : "none"
            })`
          );
          if (skippedScripts.length)
            quietLog(
              `⚠️  Existing scripts preserved: ${skippedScripts.join(", ")}`
            );
        } else {
          quietLog("ℹ️  package.json unchanged (all scripts existed)");
        }

        // Install peer dev dependencies unless skipped
        const peerDevDeps = ["typescript", "eslint", "nodemon", "esbuild"];
        if (options.install !== false) {
          const present = new Set([
            ...Object.keys(pkg.devDependencies || {}),
            ...Object.keys(pkg.dependencies || {}),
          ]);
          const toInstall = peerDevDeps.filter((d) => !present.has(d));
          if (toInstall.length) {
            quietLog(`📦 Installing peer dev deps: ${toInstall.join(", ")}`);
            await new Promise((resolve, reject) => {
              const child = spawn("npm", ["install", "-D", ...toInstall], {
                cwd: projectRoot,
                stdio: "inherit",
              });
              child.on("close", (code) =>
                code === 0
                  ? resolve()
                  : reject(new Error(`npm install exited ${code}`))
              );
              child.on("error", reject);
            });
            quietLog("✅ Peer dev dependencies installed");
          } else {
            quietLog("✔️  All peer dev dependencies already present");
          }
        } else {
          quietLog("⏭️  Skipped dependency install (--no-install)");
        }

        quietLog("--- Summary ---");
        quietLog(
          `Created files: ${created.length ? created.join(", ") : "none"}`
        );
        if (skipped.length)
          quietLog(`Skipped files (exists): ${skipped.join(", ")}`);
        quietLog("Done. Next steps:");
        if (targetDir) {
          quietLog(`  cd ${path.relative(process.cwd(), projectRoot) || projectRoot}`);
        }
        quietLog("  npm run start:dev");
      } catch (e) {
        quietError("❌ init failed", e);
        process.exit(1);
      }
    });
}
