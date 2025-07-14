import { build } from 'esbuild';
import { createEsbuildConfig } from '../../esbuild.config.js';
import { loadBuildConfig, validateBuildConfig } from '../utils/buildConfig.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Helper to run external commands.
function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', ...options });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
            } else {
                resolve();
            }
        });
        child.on('error', reject);
    });
}

export function createBuildCommand(program) {
  program
    .command('build')
    .description("Type-checks with tsc, then builds JavaScript with esbuild.")
    .option('--release', 'Creates a full release build with declarations.')
    .option('--types-only', 'Only runs the type-checking step for the entire project.')
    .option('--test', 'Builds source and test files for testing.')
    .option('--no-types', 'Skips the type-checking step.')
    .action(async (options) => {
      const { projectRoot, frameworkRoot } = program.paths;
      const { quietLog, quietError } = program;
      const isDevEnvironment = projectRoot === frameworkRoot;

      try {
        // Load build configuration
        const buildConfig = await loadBuildConfig(projectRoot);
        
        // --- Standalone Type-Checking Logic for the ENTIRE project ---
        if (options.typesOnly) {
            quietLog('🔬 Running type-checking for server code...');
            await runCommand('npx', ['tsc', '--project', 'tsconfig.json']);
            
            const clientTsConfig = path.join(projectRoot, buildConfig.client.tsconfig);
            if (fs.existsSync(clientTsConfig)) {
                quietLog('🔬 Running type-checking for client code...');
                await runCommand('npx', ['tsc', '--project', buildConfig.client.tsconfig]);
            } else {
                quietLog(`⏭️  Skipping client type-checking (no ${buildConfig.client.tsconfig} found)`);
            }

            quietLog('✅ Type-checking complete.');
            return; // Exit before the main build process
        }

        // --- Test Build Logic ---
        if (options.test) {
            quietLog('🧪 Building for tests...');
            
            // Clean _test directory
            const testDistPath = path.join(projectRoot, '_test');
            if (fs.existsSync(testDistPath)) {
                quietLog(`🧹 Cleaning test directory: ${testDistPath}`);
                fs.rmSync(testDistPath, { recursive: true, force: true });
            }

            // Type-check first
            if (options.types !== false) {
                quietLog('🔬 Type-checking for tests...');
                await runCommand('npx', ['tsc', '--project', 'tsconfig.json']);
            }

            // Build test configuration
            quietLog('📦 Building test files with esbuild...');
            const testBuildOptions = { 
                projectRoot,
                frameworkSources: [`${projectRoot}/src/**/*.ts`],
                frameworkOutdir: path.join(testDistPath, 'src'),
                frameworkOutbase: path.join(projectRoot, 'src'),
                testSources: [`${projectRoot}/test/**/*.ts`],
                testOutdir: path.join(testDistPath, 'test')
            };

            const configs = createEsbuildConfig(testBuildOptions);
            
            for (const key in configs) {
                let description;
                switch (key) {
                    case 'framework':
                        description = 'source code for tests';
                        break;
                    case 'test':
                        description = 'test files';
                        break;
                    default:
                        description = key;
                }
                quietLog(`📦 Building ${description}...`);
                await build(configs[key]);
            }

            quietLog('✅ Test build complete.');
            return; // Exit after test build
        }

        // Validate build configuration
        const validation = validateBuildConfig(buildConfig, projectRoot, isDevEnvironment, options);
        
        // Show warnings
        validation.warnings.forEach(warning => {
            quietLog(`⚠️  ${warning}`);
        });
        
        // Show errors and exit if any
        if (validation.errors.length > 0) {
            validation.errors.forEach(error => {
                quietError(`❌ ${error}`);
            });
            process.exit(1);
        }

        // --- 1. Clean ---
        const distPath = path.join(projectRoot, 'dist');
        if (fs.existsSync(distPath)) {
          quietLog(`🧹 Cleaning directory: ${distPath}`);
          fs.rmSync(distPath, { recursive: true, force: true });
        }

        // --- 2. Type-Checking (as part of the main build) ---
        if (options.types !== false) {
            quietLog('🔬 Type-checking server code...');
            await runCommand('npx', ['tsc', '--project', 'tsconfig.json']);
            
            if (validation.shouldBuildClient && validation.hasClientTsConfig) {
                quietLog('🔬 Type-checking client code...');
                await runCommand('npx', ['tsc', '--project', buildConfig.client.tsconfig]);
            }
        }

        // --- 3. Build JavaScript with esbuild ---
        quietLog('📦 Building JavaScript with esbuild...');
        const buildOptions = { projectRoot, isRelease: !!options.release };
        
        if (options.release) {
            // Release build: only build the framework source
            buildOptions.frameworkSources = [`${projectRoot}/src/**/*.ts`];
            buildOptions.frameworkOutdir = distPath;
            buildOptions.frameworkOutbase = path.join(projectRoot, 'src'); // Build src contents directly to dist
        } else {
            // Dev build: build testApp
            const appRoot = isDevEnvironment ? path.join(projectRoot, 'testApp') : projectRoot;
            const outRoot = isDevEnvironment ? path.join(distPath, 'testApp') : distPath;
            const clientOutRoot = path.join(outRoot, 'src');

            // Only build framework when developing the framework itself
            if (isDevEnvironment) {
                buildOptions.frameworkSources = [`${projectRoot}/src/**/*.ts`];
                buildOptions.frameworkOutdir = distPath;
            }

            buildOptions.serverSources = [`${appRoot}/src/**/*.ts`];
            buildOptions.serverIgnore = buildConfig.server.ignore.map(pattern => `${appRoot}/${pattern}`);
            buildOptions.serverOutdir = outRoot;
            buildOptions.serverOutbase = appRoot;
            
            // Only set up client build if validation says we should
            if (validation.shouldBuildClient) {
                const clientEntryPoint = path.join(appRoot, buildConfig.client.entryPoint);
                buildOptions.clientEntryPoint = clientEntryPoint;
                buildOptions.clientOutfile = path.join(clientOutRoot, buildConfig.client.outputBundle);
                
                // Only set client tsconfig if it exists
                if (validation.hasClientTsConfig) {
                    buildOptions.clientTsConfig = path.join(projectRoot, buildConfig.client.tsconfig);
                }
                
                buildOptions.clientCopyAssets = {
                  resolveFrom: 'cwd',
                  assets: {
                    from: buildConfig.client.assets.map(pattern => `${appRoot}/${pattern}`),
                    to: [path.join(clientOutRoot, 'public')],
                  },
                };
            }
        }

        const configs = createEsbuildConfig(buildOptions);
        
        for (const key in configs) {
          let description;
          switch (key) {
            case 'framework':
              description = 'framework source code';
              break;
            case 'server':
              description = isDevEnvironment ? 'test app server code' : 'server code';
              break;
            case 'client':
              description = isDevEnvironment ? 'test app client bundle' : 'client bundle';
              break;
            case 'test':
              description = 'test files';
              break;
            default:
              description = key;
          }
          quietLog(`📦 Building ${description}...`);
          await build(configs[key]);
        }

        // --- 4. (Release Only) Generate Declaration Files ---
        if (options.release) {
            quietLog('📜 Generating declaration files for the release...');
            await runCommand('npx', ['tsc', '--project', 'tsconfig.release.json']);
        }

        quietLog(`✅ Build complete.`);

      } catch (e) {
        quietError('❌ Build failed. It was a valiant effort, though.', e);
        process.exit(1);
      }
    });
}