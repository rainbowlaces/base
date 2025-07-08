import path from 'path';
import { fileURLToPath } from 'url';
import { coreRules, jsConfig } from './eslint.core.js';

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
    jsConfig,
    // TypeScript files - use strict type checking
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname,
            },
        },
    },
    // Apply TypeScript rules only to TypeScript files
    ...coreRules.map(rule => ({
        ...rule,
        files: rule.files || ["**/*.ts"],
    })),
    {
        files: ["test/**/*.ts"],
        rules: {
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-return": "off",
        },
    },
];