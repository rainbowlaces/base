import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import eslint from "@eslint/js";

export default [
  {
    ignores: [
      "dist/**",
      "dev/**",
      "_**/**",
      "babel.config.cjs",
      "__**/**",
      "src/core/logger/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.mjs", "*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
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
        // Default: most things should be camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Variables can be camelCase or UPPER_CASE (for constants)
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Top-level const variables should be UPPER_CASE
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["UPPER_CASE"],
          leadingUnderscore: "forbid",
        },
        // Class names, types, interfaces should be PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Parameters with _ prefix are allowed to be unused
        {
          selector: "parameter",
          modifiers: ["unused"],
          format: ["camelCase"],
          leadingUnderscore: "require",
        },
        // Allow destructured variables to keep their original names
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        // Allow any format for properties that require quotes (includes kebab-case)
        {
          selector: "property",
          modifiers: ["requiresQuotes"],
          format: null,
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSInterfaceDeclaration[id.name='HTMLElementTagNameMap'] TSPropertySignature > Literal[raw=/^\"[A-Z]/]",
          message:
            "HTMLElementTagNameMap properties must be lowercase kebab-case (custom elements must start with lowercase)",
        },
      ],
    },
  },
  {
    files: ["eslint.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["testApp/src/templates/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-exports": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  {
    files: ["src/config/**/*.ts", "eslint.config.mjs"],
    rules: {
      "no-restricted-exports": "off",
    },
  },
  {
    files: ["testApp/src/config/**/*.ts"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        // Default: most things should be camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Variables can be camelCase or UPPER_CASE (for constants)
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Top-level const variables should be UPPER_CASE
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["UPPER_CASE"],
          leadingUnderscore: "forbid",
        },
        // Class names, types, interfaces should be PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Parameters with _ prefix are allowed to be unused
        {
          selector: "parameter",
          modifiers: ["unused"],
          format: ["camelCase"],
          leadingUnderscore: "require",
        },
        // Allow destructured variables to keep their original names
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        // Object literal properties can be snake_case or camelCase
        {
          selector: "objectLiteralProperty",
          format: ["snake_case", "camelCase"],
        },
        // Allow any format for properties that require quotes (includes kebab-case)
        {
          selector: "property",
          modifiers: ["requiresQuotes"],
          format: null,
        },
      ],
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  }
];
