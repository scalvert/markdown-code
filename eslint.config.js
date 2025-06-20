import globals from "globals";
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Base JavaScript rules (Airbnb-inspired)
      "no-console": "off", // We want console in CLI tools
      "no-unused-vars": "off",
      "no-var": "error",
      "prefer-const": "error",
      "no-use-before-define": "off", // Handled by TypeScript
      "no-shadow": "off", // Handled by TypeScript
      "no-undef": "off", // Handled by TypeScript
      "consistent-return": "error",
      "no-else-return": "error",
      "no-multi-spaces": "error",
      "no-trailing-spaces": "error",
      "space-before-blocks": "error",
      "keyword-spacing": "error",
      "comma-dangle": ["error", "always-multiline"],
      "semi": ["error", "always"],
      "quotes": ["error", "single", { avoidEscape: true }],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "indent": ["error", 2],
      "max-len": ["error", { code: 100, ignoreUrls: true }],

      // TypeScript-specific rules (Airbnb-inspired)
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-use-before-define": "error",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
]; 