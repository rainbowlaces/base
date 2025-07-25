import { copy } from 'esbuild-plugin-copy';
import { glob } from 'glob';

export function createEsbuildConfig(options) {
  const { projectRoot, minify = false, ...builds } = options;

  const baseNodeConfig = {
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: 'inline',
  };

  const configs = {};

  // --- Build Definitions ---

  if (builds.frameworkSources) {
    configs.framework = {
      ...baseNodeConfig,
      entryPoints: glob.sync(builds.frameworkSources),
      outdir: builds.frameworkOutdir,
      outbase: builds.frameworkOutbase || projectRoot,
    };
  }

  if (builds.serverSources) {
    configs.server = {
      ...baseNodeConfig,
      entryPoints: glob.sync(builds.serverSources, { ignore: builds.serverIgnore || [] }),
      outdir: builds.serverOutdir,
      outbase: builds.serverOutbase,
      keepNames: true,
    };
  }
  
  if (builds.testSources) {
    configs.test = {
        ...baseNodeConfig,
        entryPoints: glob.sync(builds.testSources),
        outdir: builds.testOutdir,
        keepNames: true,
    };
  }

  if (builds.clientEntryPoint) {
    const clientConfig = {
      // BUNDLED client-side code
      entryPoints: [builds.clientEntryPoint],
      bundle: true,
      sourcemap: 'inline',
      outfile: builds.clientOutfile,
      format: 'esm',
      platform: 'browser',
      target: ['chrome138', 'firefox139', 'safari18', 'edge137'],
      minify: minify,
      plugins: builds.clientCopyAssets ? [copy(builds.clientCopyAssets)] : [],
    };
    
    // Only set tsconfig if it exists
    if (builds.clientTsConfig) {
      clientConfig.tsconfig = builds.clientTsConfig;
    }
    
    configs.client = clientConfig;
  }

  return configs;
}