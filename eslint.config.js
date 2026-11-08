// Lint: ESLint's and typescript-eslint's recommended rules, and React's
// rules of hooks.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "playwright-report", "test-results", ".netlify"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["server/**", "netlify/**", "test/**", "e2e/**", "scripts/**", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
