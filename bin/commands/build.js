import { build } from 'esbuild';
import { createEsbuildConfig } from '../../esbuild.config.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Helper to run external commands. (Unchanged)
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
      const isDevEnvironment = projectRoot === frameworkRoot;

      try {
        // --- Test Build Logic (Unchanged) ---
        if (options.test) {
          if (!isDevEnvironment) {
            quietError('Error: --test flag can only be used from within the base framework repository.');
            process.exit(1);
          }
          const testOutdir = path.join(projectRoot, '_test');
          quietLog(`🧹 Cleaning test directory: ${testOutdir}`);
          if (fs.existsSync(testOutdir)) {
            fs.rmSync(testOutdir, { recursive: true, force: true });
          }

          const testConfig = createEsbuildConfig({
            projectRoot,
            testSources: [`${projectRoot}/src/**/*.ts`, `${projectRoot}/test/**/*.ts`],
            testOutdir: testOutdir,
          });

          quietLog('Building source and tests for execution...');
          await build(testConfig.test);
          quietLog('✅ Test build complete. Artifacts are in _test/');
          return;
        }

        // --- Standard Build Flow (Unchanged parts) ---
        const tsconfigName = options.release ? 'tsconfig.release.json' : 'tsconfig.json';
        const tsconfigPath = path.join(projectRoot, tsconfigName);

        if (options.typesOnly) {
            quietLog(`🔬 Running type-checking only using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
            quietLog('✅ Type-checking complete.');
            return;
        }

        const distPath = path.join(projectRoot, 'dist');
        if (fs.existsSync(distPath)) {
            quietLog(`🧹 Cleaning directory: ${distPath}`);
            fs.rmSync(distPath, { recursive: true, force: true });
        }

        if (!options.noTypes) {
            quietLog(`🔬 Type-checking using ${tsconfigName}...`);
            await runCommand('npx', ['tsc', '--project', tsconfigPath]);
        } else {
            quietLog('Skipping type-checking as requested. Good luck.');
        }

        quietLog('📦 Building JavaScript with esbuild...');
        const buildOptions = {
          projectRoot,
          isRelease: !!options.release,
        };
        
        // --- Corrected Build Options Logic ---
        if (options.release) {
            buildOptions.frameworkSources = [`${projectRoot}/src/**/*.ts`];
            buildOptions.frameworkOutdir = path.join(projectRoot, 'dist');
        } else {
            const appRoot = isDevEnvironment ? path.join(projectRoot, 'testApp') : projectRoot;
            const outRoot = isDevEnvironment ? path.join(distPath, 'testApp') : distPath;

            if (isDevEnvironment) {
                buildOptions.frameworkSources = [`${projectRoot}/src/**/*.ts`];
                buildOptions.frameworkOutdir = path.join(distPath, 'src');
            }
            
            buildOptions.serverSources = [`${appRoot}/src/**/*.ts`];
            buildOptions.serverIgnore = [`${appRoot}/src/elements/**`];
            buildOptions.serverOutdir = outRoot;
            buildOptions.serverOutbase = appRoot;

            // --- THE FIX IS HERE ---
            // The output for client assets needs to be inside the 'src' subdirectory
            // of the testApp's distribution folder to match the original structure.
            const clientOutRoot = path.join(outRoot, 'src');

            buildOptions.clientEntryPoint = path.join(appRoot, 'src', 'elements', 'loader.ts');
            buildOptions.clientOutfile = path.join(clientOutRoot, 'public', 'bundle.js');
            buildOptions.clientCopyAssets = {
                resolveFrom: 'cwd',
                assets: {
                    from: [`${appRoot}/src/public/*`],
                    to: [path.join(clientOutRoot, 'public')],
                },
            };
        }

        // --- Build Execution (Unchanged) ---
        const configs = createEsbuildConfig(buildOptions);
        
        for (const key in configs) {
            quietLog(`Building target: ${key}...`);
            await build(configs[key]);
        }

        quietLog(`✅ ${options.release ? 'Release' : 'Development'} build complete.`);

      } catch (e) {
        quietError('❌ Build failed. It was a valiant effort, though.', e);
        process.exit(1);
      }
    });
}