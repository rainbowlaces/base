import { build } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { glob } from 'glob';
import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Creates a set of esbuild configuration objects based on the provided options.
 * This function understands the difference between running in the framework's own
 * development environment versus a downstream consumer's project, and between
 * a local test build versus a final release build.
 *
 * @param {object} options
 * @param {string} options.projectRoot - The absolute path to the root of the project being built.
 * @param {boolean} [options.isDev=false] - True if running in the base framework's dev environment.
 * @param {boolean} [options.isRelease=false] - True if this is a release build.
 * @returns {object} The esbuild configurations.
 */
export function createEsbuildConfig(options) {
  const { projectRoot, isDev = false, isRelease = false } = options;

  // We need the package.json to correctly identify external dependencies.
  const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

  // --- Framework Config ---
  const frameworkConfig = {
    entryPoints: glob.sync([`${projectRoot}/src/**/*.ts`]),
    outdir: isRelease ? path.join(projectRoot, 'dist') : path.join(projectRoot, 'dist', 'src'),
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: true,
    tsconfig: path.join(projectRoot, 'tsconfig.json'),
    bundle: true,
    external: Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {})),
    plugins: [
      esbuildPluginFilePathExtensions({ esmExtension: 'js' }),
    ],
  };

  // --- Application Configs ---
  const appRoot = isDev ? path.join(projectRoot, 'testApp') : projectRoot;

  const serverConfig = {
    entryPoints: glob.sync([`${appRoot}/src/**/*.ts`], { ignore: [`${appRoot}/src/elements/**`] }),
    outdir: isDev ? path.join(projectRoot, 'dist', 'testApp') : path.join(projectRoot, 'dist'),
    outbase: appRoot,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    sourcemap: true,
    tsconfig: path.join(projectRoot, 'tsconfig.json'),
    bundle: true,
    keepNames: true,
    external: Object.keys(pkg.dependencies || {}),
    plugins: [
      esbuildPluginFilePathExtensions({ esmExtension: 'js' }),
    ],
  };

  const configs = {
    server: serverConfig,
    framework: frameworkConfig,
  };

  // Only create client config if elements/loader.ts exists (framework convention)
  const clientEntryPoint = `${appRoot}/src/elements/loader.ts`;
  if (existsSync(clientEntryPoint)) {
    const clientConfig = {
      entryPoints: [clientEntryPoint],
      bundle: true,
      outfile: isDev ? path.join(projectRoot, 'dist', 'testApp', 'src', 'public', 'bundle.js') : path.join(projectRoot, 'dist', 'public', 'bundle.js'),
      format: 'esm',
      minify: true,
      plugins: [
        copy({
          resolveFrom: 'cwd',
          assets: {
            from: [`${appRoot}/src/public/*`],
            to: [ isDev ? path.join(projectRoot, 'dist', 'testApp', 'src', 'public') : path.join(projectRoot, 'dist', 'public') ],
          },
        }),
      ],
    };
    configs.client = clientConfig;
  }

  // --- Test Environment Config ---
  // This configuration is only created when running in the dev environment.
  if (isDev) {
    configs.test = {
      entryPoints: glob.sync([`${projectRoot}/src/**/*.ts`, `${projectRoot}/test/**/*.ts`]),
      outdir: path.join(projectRoot, '_test.dist'),
      platform: 'node',
      target: 'node24',
      format: 'esm',
      sourcemap: true,
      bundle: true,
      keepNames: true,
      external: Object.keys(pkg.dependencies || {}),
      plugins: [
        esbuildPluginFilePathExtensions({
          esmExtension: 'js',
        }),
      ],
    };
  }

  return configs;
}

// This allows the file to be run directly with `node esbuild.config.js`.
// It will always run a full development build, building both the framework and the testApp.
if (import.meta.url.endsWith(process.argv[1])) {
  console.log("Running esbuild.config.js directly for a full development build...");
  (async () => {
    try {
      const config = createEsbuildConfig({
        projectRoot: process.cwd(),
        isDev: true,
        isRelease: false
      });
      
      console.log("Building framework source for testApp...");
      await build(config.framework);

      console.log("Building testApp server...");
      await build(config.server);

      if (config.client) {
        console.log("Building testApp client...");
        await build(config.client);
      } else {
        console.log("No client build needed (no elements/loader.ts found).");
      }

      console.log("✅ Direct run build complete.");
    } catch (e) {
      console.error("❌ Direct run build failed.", e);
      process.exit(1);
    }
  })();
}
