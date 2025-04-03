import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: "./tests",

  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: "line", // "html"

  // Global use
  use: {
    // Base URL to use in actions like `await page.goto("/")`.
    baseURL: "http://localhost:3000",

    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
  },

  // Configure projects for major browsers.
  projects: [
    {
      name: "Locale files validation",
      fullyParallel: false,
      testMatch: ["**/locale-files.ts"],
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
      dependencies: ["Locale files validation"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["Locale files validation"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["Locale files validation"],
    }
  ],
  webServer: {
    timeout: 1000 * 1000,
    command: "yarn run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});