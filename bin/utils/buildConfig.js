import fs from 'fs';
import path from 'path';

// Default build configuration
const DEFAULT_CONFIG = {
  client: {
    entryPoint: 'src/elements/loader.ts',
    tsconfig: 'tsconfig.client.json',
    assets: ['src/public/*'],
    outputBundle: 'public/bundle.js'
  },
  server: {
    ignore: ['src/elements/**']
  }
};

/**
 * Load and merge user build config with defaults
 * @param {string} projectRoot - Project root directory
 * @returns {object} Merged configuration
 */
export async function loadBuildConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'base.config.js');
  
  let userConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      const configModule = await import(`file://${configPath}`);
      userConfig = configModule.default || {};
    } catch (error) {
      throw new Error(`Failed to load base.config.js: ${error.message}`);
    }
  }

  // Deep merge user config with defaults
  return {
    client: {
      ...DEFAULT_CONFIG.client,
      ...userConfig.client
    },
    server: {
      ...DEFAULT_CONFIG.server,
      ...userConfig.server
    }
  };
}

/**
 * Validate build configuration and file existence
 * @param {object} config - Build configuration
 * @param {string} projectRoot - Project root directory
 * @param {boolean} isDevEnvironment - Whether we're in dev environment
 * @returns {object} Validation result with warnings/errors
 */
export function validateBuildConfig(config, projectRoot, isDevEnvironment, options = {}) {
  const warnings = [];
  const errors = [];
  
  // Check if --release is being used outside of framework development
  if (options.release && !isDevEnvironment) {
    errors.push(
      `The --release flag is only available when developing the framework itself. ` +
      `Consumer projects should use the regular build command.`
    );
  }
  
  const appRoot = isDevEnvironment ? path.join(projectRoot, 'testApp') : projectRoot;
  const clientEntryPoint = path.join(appRoot, config.client.entryPoint);
  const clientTsConfig = path.join(projectRoot, config.client.tsconfig);
  
  const hasClientEntry = fs.existsSync(clientEntryPoint);
  const hasClientTsConfig = fs.existsSync(clientTsConfig);
  
  if (hasClientEntry && !hasClientTsConfig && options.types !== false) {
    errors.push(
      `Client entry point found (${config.client.entryPoint}) but no TypeScript config (${config.client.tsconfig}). ` +
      `Either create ${config.client.tsconfig} or use --no-types to skip type checking.`
    );
  }
  
  if (hasClientEntry && !hasClientTsConfig && options.types === false) {
    warnings.push(
      `Client build proceeding without TypeScript config (${config.client.tsconfig}) due to --no-types flag.`
    );
  }
  
  if (!hasClientEntry && hasClientTsConfig) {
    warnings.push(
      `TypeScript client config found (${config.client.tsconfig}) but no client entry point (${config.client.entryPoint}). ` +
      `Client build will be skipped.`
    );
  }
  
  return { 
    warnings, 
    errors, 
    hasClientEntry, 
    hasClientTsConfig,
    shouldBuildClient: hasClientEntry
  };
}
