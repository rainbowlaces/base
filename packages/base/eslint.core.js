import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';

// JavaScript-specific configuration
export const jsRules = {
  files: ["**/*.js"],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Basic ESLint rules for JS files
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "no-restricted-exports": [
      "error",
      {
        restrictDefaultExports: {
          direct: true,
        },
      },
    ],
  },
};

/**
 * Creates TypeScript ESLint configuration with customizable options
 * @param {Object} options - Configuration options
 * @param {string} [options.tsconfigRootDir] - Root directory for tsconfig.json (defaults to process.cwd())
 * @param {string} [options.clientSourcePath] - Path pattern for client-side files (e.g., "src/elements/star-star/star")
 * @returns {Array} ESLint configuration array for TypeScript files
 */
export function tsRules(options = {}) {
  const { tsconfigRootDir = process.cwd(), clientSourcePath } = options;
  const baseConfig = [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          { allowNumber: true, allowAny: true, allowBoolean: true },
        ],
        "@typescript-eslint/no-unnecessary-type-parameters": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/non-nullable-type-assertion-style": "off",
        "require-await": "off",
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/consistent-type-assertions": [
          "error",
          {
            assertionStyle: "as",
          },
        ],
        "@typescript-eslint/no-unnecessary-type-assertion": [
          "error",
          {
            typesToIgnore: ["CustomEvent"],
          },
        ],
        "no-restricted-exports": [
          "error",
          {
            restrictDefaultExports: {
              direct: true,
            },
          },
        ],
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            prefer: "type-imports",
            disallowTypeAnnotations: false,
            fixStyle: "inline-type-imports",
          },
        ],
        "@typescript-eslint/naming-convention": [
          "error",
          { selector: "default", format: ["camelCase"], leadingUnderscore: "allow", trailingUnderscore: "allow" },
          { selector: "variable", format: ["camelCase", "UPPER_CASE"], leadingUnderscore: "allow", trailingUnderscore: "allow" },
          { selector: "variable", modifiers: ["const", "global"], format: ["UPPER_CASE"], leadingUnderscore: "forbid" },
          { selector: "typeLike", format: ["PascalCase"] },
          { selector: "enumMember", format: ["UPPER_CASE"] },
          { selector: "parameter", modifiers: ["unused"], format: ["camelCase"], leadingUnderscore: "require" },
          { selector: "variable", modifiers: ["destructured"], format: null },
          { selector: "property", modifiers: ["requiresQuotes"], format: null },
          { selector: "property", format: ["camelCase", "PascalCase"] },
          { selector: "method", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector: "TSInterfaceDeclaration[id.name='HTMLElementTagNameMap'] TSPropertySignature > Literal[raw=/^\"[A-Z]/]",
            message: "HTMLElementTagNameMap properties must be lowercase kebab-case (custom elements must start with lowercase)",
          },
        ],
  // Removed custom project rule: no-self-referential-config
      },
    },
  ];
  
  if (clientSourcePath) {
    return [
      // Server-side TypeScript files
      ...baseConfig.map(config => ({
        ...config,
        files: ["**/*.ts"],
        ignores: [clientSourcePath],
        languageOptions: config.languageOptions ? {
          ...config.languageOptions,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir,
          },
        } : {
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir,
          },
        },
      })),
      // Client-side TypeScript files
      ...baseConfig.map(config => ({
        ...config,
        files: [clientSourcePath],
        languageOptions: config.languageOptions ? {
          ...config.languageOptions,
          parserOptions: {
            project: "./tsconfig.client.json",
            tsconfigRootDir,
          },
        } : {
          parserOptions: {
            project: "./tsconfig.client.json",
            tsconfigRootDir,
          },
        },
      })),
    ];
  }
  
  // Default behavior for single tsconfig
  return baseConfig.map(config => ({
    ...config,
    files: ["**/*.ts"],
    languageOptions: config.languageOptions ? {
      ...config.languageOptions,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir,
      },
    } : {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir,
      },
    },
  }));
}

/**
 * Creates test-specific ESLint configuration that relaxes type checking rules
 * @param {Object} options - Configuration options  
 * @param {string} [options.testPattern] - Glob pattern for test files (defaults to test slash star star slash star dot ts)
 * @returns {Object} ESLint configuration for test files
 */
export function testRules(options = {}) {
  const { testPattern = "test/**/*.ts" } = options;
  
  return {
    files: [testPattern],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  };
}