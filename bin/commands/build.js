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
      const { quietLog, quietError } = program;
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
          quietLog(`🧹 Cleaning test directory: ${testDistPath}`);
          if (fs.existsSync(testDistPath)) {
            fs.rmSync(testDistPath, { recursive: true, force: true });
          }
          
          quietLog('Building source and tests for execution...');
          await build(config.test);
          quietLog('✅ Test build complete. Artifacts are in _test.dist/');
          return; // Stop here.
        }

        const tsconfigName = options.release ? 'tsconfig.release.json' : 'tsconfig.json';
        const tsconfigPath = path.join(projectRoot, tsconfigName);

        // --- Types-Only Build ---
        if (options.typesOnly) {
            quietLog(`🔬 Running type-checking only using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
            quietLog('✅ Type-checking complete.');
            return; // Stop here.
        }

        // --- Standard Build Flow (Dev or Release) ---

        // 1. Clean the main dist directory.
        const distPath = path.join(projectRoot, 'dist');
        if (fs.existsSync(distPath)) {
            quietLog(`🧹 Cleaning directory: ${distPath}`);
            fs.rmSync(distPath, { recursive: true, force: true });
        }

        // 2. Run TypeScript compiler, unless skipped.
        if (options.types) {
            quietLog(`🔬 Type-checking using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
        } else {
            quietLog('Skipping type-checking as requested. Good luck.');
        }

        // 3. Generate JavaScript with esbuild.
        quietLog('📦 Building JavaScript with esbuild...');

        if (options.release) {
          await build(config.framework);
          quietLog('✅ Framework release build complete.');
        } else {
          if (isDev) {
            quietLog('Building framework source for testApp...');
            await build(config.framework);
          }
          quietLog('Building application server...');
          await build(config.server);
          quietLog('Building application client...');
          await build(config.client);
          quietLog('✅ Development build complete.');
        }

      } catch (e) {
        quietError('❌ Build failed. It was a valiant effort, though.', e);
        process.exit(1);
      }
    });
}