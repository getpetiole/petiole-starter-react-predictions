import { defineConfig } from "vitest/config";

// The unit tests: the function's forwarding on a fake fetch, and the page's
// own logic, apart from React.
export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
  },
});
