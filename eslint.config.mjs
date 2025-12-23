import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: [
      "public/**",
      "dist/**",
      "src/auto/**",
      "src/live2d/**",
      "tests/**",
      "src/types/vue-global.d.ts",
      "tailwind.config.js",
      "postcss.config.js",
    ],
  },
  // Base ESLint recommended config
  eslint.configs.recommended,
  // TypeScript files configuration
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Browser globals
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        // Node globals
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        // Web APIs
        File: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-undef": "off", // TypeScript handles this
    },
  },
  // Vue files configuration
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
      globals: {
        // Browser globals
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        // Node globals
        process: "readonly",
        // Web APIs
        File: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-undef": "off", // TypeScript handles this
    },
  },
  // Prettier config (disables conflicting rules)
  eslintConfigPrettier,
];
