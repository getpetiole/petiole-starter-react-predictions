import { defineConfig } from "vitest/config";

// The contract tests: the page's calls, through the site's function, to a
// mock of the Petiole API that Prism serves from the spec published with
// the SDK this app depends on (scripts/prism.mjs). Prism refuses a request
// the spec does not allow, so the app sends what the API takes.
export default defineConfig({
  test: {
    include: ["test/contract/**/*.test.ts"],
    globalSetup: ["test/contract/prism.ts"],
    testTimeout: 30_000,
  },
});
