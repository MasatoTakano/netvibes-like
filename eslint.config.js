import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import vueEslintParser from "vue-eslint-parser";

export default [
  {
    ignores: ["node_modules", ".nuxt", ".output", ".data"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      // Add your custom rules here
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        project: ["./tsconfig.json", "./server/tsconfig.json"], // Add project for type-aware linting
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].rules,
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "warn", // Change to warn
      "@typescript-eslint/no-explicit-any": "off", // Turn off
      // Add your custom TypeScript rules here
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueEslintParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        parser: tsParser,
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      ...pluginVue.configs.recommended.rules,
      "vue/no-v-html": "off", // Turn off for now, but should be addressed
      // Add your custom Vue rules here
    },
  },
  prettierConfig,
];
