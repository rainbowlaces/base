import { build } from 'esbuild';
import { createEsbuildConfig } from '../../esbuild.config.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Helper to run external commands.
function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', ...options });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} ${args.join(' ')} failed with exit code ${code}`));
                return;
            }
            resolve();
        });
        child.on('error', (err) => {
            reject(err);
        });
    });
}

export function createBuildCommand(program) {
  program
    .command('build')
    .description("Cleans, type-checks, and builds the project for various environments.")
    .option('--test', 'Creates a build for the test environment.')
    .option('--release', 'Creates a full release build.')
    .option('--types-only', 'Only runs the type-checking step.')
    .option('--no-types', 'Skips the type-checking step.')
    .action(async (options) => {
      const { projectRoot, frameworkRoot } = program.paths;
      const isDev = projectRoot === frameworkRoot;

      try {
        const config = createEsbuildConfig({
          projectRoot,
          isDev,
          isRelease: !!options.release,
        });

        // --- Test Build ---
        // This is a special mode that takes precedence over all others.
        if (options.test) {
          if (!isDev) {
            console.error('Error: --test flag can only be used from within the base framework repository.');
            process.exit(1);
          }
          const testDistPath = path.join(projectRoot, '_test.dist');
          console.log(`🧹 Cleaning test directory: ${testDistPath}`);
          if (fs.existsSync(testDistPath)) {
            fs.rmSync(testDistPath, { recursive: true, force: true });
          }
          
          console.log('Building source and tests for execution...');
          await build(config.test);
          console.log('✅ Test build complete. Artifacts are in _test.dist/');
          return; // Stop here.
        }

        const tsconfigName = options.release ? 'tsconfig.release.json' : 'tsconfig.json';
        const tsconfigPath = path.join(projectRoot, tsconfigName);

        // --- Types-Only Build ---
        if (options.typesOnly) {
            console.log(`🔬 Running type-checking only using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
            console.log('✅ Type-checking complete.');
            return; // Stop here.
        }

        // --- Standard Build Flow (Dev or Release) ---

        // 1. Clean the main dist directory.
        const distPath = path.join(projectRoot, 'dist');
        if (fs.existsSync(distPath)) {
            console.log(`🧹 Cleaning directory: ${distPath}`);
            fs.rmSync(distPath, { recursive: true, force: true });
        }

        // 2. Run TypeScript compiler, unless skipped.
        if (options.types) {
            console.log(`🔬 Type-checking using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
        } else {
            console.log('Skipping type-checking as requested. Good luck.');
        }

        // 3. Generate JavaScript with esbuild.
        console.log('📦 Building JavaScript with esbuild...');

        if (options.release) {
          await build(config.framework);
          console.log('✅ Framework release build complete.');
        } else {
          if (isDev) {
            console.log('Building framework source for testApp...');
            await build(config.framework);
          }
          console.log('Building application server...');
          await build(config.server);
          console.log('Building application client...');
          await build(config.client);
          console.log('✅ Development build complete.');
        }

      } catch (e) {
        console.error('❌ Build failed. It was a valiant effort, though.', e);
        process.exit(1);
      }
    });
}