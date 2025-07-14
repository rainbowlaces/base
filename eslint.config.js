import path from 'path';
import { fileURLToPath } from 'url';
import { jsRules, tsRules, testRules } from './eslint.core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// eslint-disable-next-line no-restricted-exports
export default [
    {
        ignores: [
            "dist/**",
        ],
    },
    // JavaScript files - use basic rules without TypeScript type checking
    jsRules,
    // TypeScript files - use strict type checking
    ...tsRules({ tsconfigRootDir: __dirname }),
    // Test files - relax type checking rules
    testRules(),
];