import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import eslint from '@eslint/js';

// JavaScript-specific configuration
export const jsConfig = {
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

// eslint-disable-next-line @typescript-eslint/naming-convention
export const coreRules = [
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
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
    },
  },
];