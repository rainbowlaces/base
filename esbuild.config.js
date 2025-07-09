import { build } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { glob } from 'glob';
import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Creates a generic set of esbuild configuration objects based on explicit options.
 * This function is "dumb" by design; it doesn't know about dev/release environments,
 * only the explicit paths and settings it is given.
 *
 * @param {object} options
 * @param {string} options.projectRoot - The absolute path to the root of the project.
 * @param {boolean} [options.isRelease=false] - True if this is a release build (for minification).
 *
 * @param {string[]} [options.frameworkSources] - Globs for framework source files.
 * @param {string} [options.frameworkOutdir] - Output directory for framework build.
 *
 * @param {string[]} [options.serverSources] - Globs for server source files.
 * @param {string[]} [options.serverIgnore] - Globs to ignore for server source files.
 * @param {string} [options.serverOutdir] - Output directory for server build.
 * @param {string} [options.serverOutbase] - The 'outbase' for the server build.
 *
 * @param {string} [options.clientEntryPoint] - Entry point for the client bundle.
 * @param {string} [options.clientOutfile] - Output file for the client bundle.
 * @param {object} [options.clientCopyAssets] - Asset copy rules for the esbuild-plugin-copy.
 *
 * @param {string[]} [options.testSources] - Globs for test files.
 * @param {string} [options.testOutdir] - Output directory for test build.
 *
 * @returns {object} The esbuild configurations.
 */
export function createEsbuildConfig(options) {
  const { projectRoot, isRelease = false, ...builds } = options;

  // --- Common Setup ---
  const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const allDependencies = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {}));
  const appDependencies = Object.keys(pkg.dependencies || {});
  const filePathExtensionsPlugin = esbuildPluginFilePathExtensions({ esmExtension: 'js' });

  // --- Base Config ---
  const baseNodeConfig = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: true,
    tsconfig: path.join(projectRoot, 'tsconfig.json'),
  };

  const configs = {};

  // --- Build Definitions ---
  // Each build is only configured if its corresponding 'sources' or 'entryPoint' option is provided.

  if (builds.frameworkSources) {
    configs.framework = {
      ...baseNodeConfig,
      entryPoints: glob.sync(builds.frameworkSources),
      outdir: builds.frameworkOutdir,
      external: allDependencies,
      plugins: [filePathExtensionsPlugin],
    };
  }

  if (builds.serverSources) {
    configs.server = {
      ...baseNodeConfig,
      entryPoints: glob.sync(builds.serverSources, { ignore: builds.serverIgnore || [] }),
      outdir: builds.serverOutdir,
      outbase: builds.serverOutbase,
      keepNames: true,
      external: appDependencies,
      plugins: [filePathExtensionsPlugin],
    };
  }

  if (builds.clientEntryPoint && existsSync(builds.clientEntryPoint)) {
    configs.client = {
      entryPoints: [builds.clientEntryPoint],
      bundle: true,
      outfile: builds.clientOutfile,
      format: 'esm',
      minify: isRelease, // Minify only on release
      plugins: builds.clientCopyAssets ? [copy(builds.clientCopyAssets)] : [],
    };
  }

  if (builds.testSources) {
    configs.test = {
      ...baseNodeConfig,
      entryPoints: glob.sync(builds.testSources),
      outdir: builds.testOutdir,
      keepNames: true,
      external: appDependencies,
      plugins: [filePathExtensionsPlugin],
    };
  }

  return configs;
}


// This allows the file to be run directly with `node esbuild.config.js`.
// This is now the "convention" layer, showing how to use the generic function
// for this project's specific development workflow.
if (import.meta.url.endsWith(process.argv[1])) {
  console.log("Running esbuild.config.js directly for a full development build...");
  (async () => {
    try {
      const projectRoot = process.cwd();
      const testAppRoot = path.join(projectRoot, 'testApp');
      const distDir = path.join(projectRoot, 'dist');

      const allConfigs = createEsbuildConfig({
        projectRoot,
        isRelease: false, // This is a dev build

        // Framework build (for the testApp)
        frameworkSources: [`${projectRoot}/src/**/*.ts`],
        frameworkOutdir: path.join(distDir, 'src'),

        // TestApp server build
        serverSources: [`${testAppRoot}/src/**/*.ts`],
        serverIgnore: [`${testAppRoot}/src/elements/**`],
        serverOutdir: path.join(distDir, 'testApp'),
        serverOutbase: testAppRoot,

        // TestApp client build
        clientEntryPoint: path.join(testAppRoot, 'src', 'elements', 'loader.ts'),
        clientOutfile: path.join(distDir, 'testApp', 'src', 'public', 'bundle.js'),
        clientCopyAssets: {
          resolveFrom: 'cwd',
          assets: {
            from: [`${testAppRoot}/src/public/*`],
            to: [path.join(distDir, 'testApp', 'src', 'public')],
          },
        },
      });

      console.log("Building framework source for testApp...");
      await build(allConfigs.framework);

      console.log("Building testApp server...");
      await build(allConfigs.server);

      if (allConfigs.client) {
        console.log("Building testApp client...");
        await build(allConfigs.client);
      } else {
        console.log("No client build needed (entry point not found).");
      }

      console.log("✅ Direct run build complete.");
    } catch (e) {
      console.error("❌ Direct run build failed.", e);
      process.exit(1);
    }
  })();
}