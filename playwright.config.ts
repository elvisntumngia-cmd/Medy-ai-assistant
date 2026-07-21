import { defineConfig } from "@playwright/test";

const webUrl = "http://127.0.0.1:5281";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: webUrl, trace: "on-first-retry" },
});
