/* eslint-disable no-undef */
/* eslint-env node */
/* eslint no-console: "off" */
import esbuild from 'esbuild';
import { glob } from 'glob';

// Find all TypeScript files in both source and test directories.
// eslint-disable-next-line @typescript-eslint/naming-convention
const sourceFiles = await glob(['src/**/*.ts', 'test/**/*.ts']);

console.log(`Building ${sourceFiles.length} files for testing...`);

esbuild.build({
  entryPoints: sourceFiles,
  outdir: '_test.dist',
  
  // Key Setting: We are NOT bundling.
  // This transpiles each file individually, preserving the
  // src/ and test/ directory structure in the output.
  bundle: false,
  
  // Key Setting: Sourcemaps are enabled.
  // This ensures stack traces in test failures point to the
  // original TypeScript source code, not the compiled JavaScript.
  sourcemap: 'inline',  
  platform: 'node',
  format: 'esm',
}).then(() => {
  console.log('Build complete. Test artifacts are in _test.dist/');
// eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
}).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
