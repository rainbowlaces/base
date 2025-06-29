/* eslint-disable no-undef */
/* eslint-env node */
/* eslint no-console: "off" */

import "source-map-support"; // Enable source maps for better debugging
import esbuild from 'esbuild';
import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions';
import { glob } from 'glob';
import { readFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Find all TypeScript files in both source and test directories.
// eslint-disable-next-line @typescript-eslint/naming-convention
const sourceFiles = await glob(['src/**/*.ts', 'test/**/*.ts']);

console.log(`Building ${sourceFiles.length} files for testing...`);

// --- Server Build ---

esbuild.build({
  entryPoints: sourceFiles,
  outdir: '_test.dist',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true, // 
  tsconfig: 'tsconfig.json',
  bundle: true,
  keepNames: true,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  external: Object.keys(pkg.dependencies),
  plugins: [
    esbuildPluginFilePathExtensions({
      // Explicitly tell the plugin to use .js for ESM imports.
      esmExtension: 'js', 
    }),
  ],
}).then(() => {
  console.log('Build complete. Test artifacts are in _test.dist/');
// eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
}).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});