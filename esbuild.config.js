/* eslint-disable no-undef */
import { build } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { glob } from 'glob';
import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions';
import { readFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// --- Server Build ---
build({
  entryPoints: await glob(['./src/**/*.ts', './testApp/**/*.ts'], { ignore: './testApp/src/components/**' }),
  outdir: 'dist',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
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
}).catch(() => process.exit(1));


// --- Client Build and asset copy: Bundle it up ---
build({
    entryPoints: ['./testApp/src/components/something.ts'],
    bundle: true,
    outfile: './dist/testApp/src/public/bundle.js',
    format: 'esm',
    minify: true,
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: './testApp/src/public/*',
          to: './dist/testApp/src/public',
        }
      }),
    ],
}).catch(() => process.exit(1));