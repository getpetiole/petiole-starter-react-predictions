import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests: the built app in Vite's preview server, under the
// headers of netlify.toml, its /api sent on to the Prism mock of the API's
// spec instead of the Petiole API. Run `npm run build` first.
const MOCK = "http://127.0.0.1:4010";
const APP = "http://localhost:4173";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: { baseURL: APP, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node scripts/prism.mjs 4010",
      // Any answer will do: without a key Prism's is 401.
      url: `${MOCK}/v1/models`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
    },
    {
      command: "npm run preview -- --port 4173 --strictPort",
      url: APP,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // No key of the site's own, so the app asks for one.
      env: { PETIOLE_MOCK_URL: MOCK, PETIOLE_API_KEY: "" },
    },
  ],
});
