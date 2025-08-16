import path from 'path';
import { fileURLToPath } from 'url';
import { jsRules, tsRules, testRules } from '@rainbowlaces/base/eslint.core.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default [
  { ignores: ['dist/**', '_*/**/*', 'node_modules/**', 'src/client/**/*'] },
  jsRules,
  ...tsRules({ tsconfigRootDir: __dirname }),
  testRules(),
];
