import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'babel/**','dev/**','deploy/**', '_**/**','babel.config.cjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  prettier,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "no-restricted-exports": [
        "error",
        {
          "restrictDefaultExports": {
            "direct": true
          }
        }
      ]
    }
  },
  {
    files: ['src/templates/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/testApp/src/config/**/*.ts', 'eslint.config.mjs'],
    rules: {
      'no-restricted-exports': 'off',
    },
  },
];