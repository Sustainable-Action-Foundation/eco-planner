import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "tests/unit",
  workers: 1,
  retries: 0,
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report-unit", open: "never" }]],
  use: {
    locale: "cimode",
    timezoneId: "Europe/Stockholm",
    actionTimeout: 5 * 1000,
  },
  projects: [
    {
      name: "Locale files validation",
      testMatch: ["**/locale-files.ts"],
      retries: 0, // File reading can't be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Recipe unit tests",
      testMatch: ["**/recipe-unit.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    }
  ]
});
