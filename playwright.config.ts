import { defineConfig, devices } from "playwright/test";

export const webserverURL = process.env.TEST_BASE_URL || "http://localhost:3000";

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: "./tests",

  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 0 : 0,

  // // Opt out of parallel tests on CI.
  // workers: process.env.CI ? 1 : undefined,
  workers: undefined, // Always run in parallel

  // Reporter to use
  // reporter: [["html", { open: "never" }], ["list"]],
  reporter: process.env.CI ?
    [["github"]]
    :
    [["list"], ["html", { open: "never" }]],

  // Global use
  use: {
    // Base URL to use in actions like `await page.goto("/")`.
    baseURL: webserverURL,

    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
  },

  globalTeardown: "./tests/lib/global.teardown.ts",
  
  // Configure projects for major browsers.
  projects: [
    {
      name: "Locale files validation",
      testMatch: ["**/locale-files.ts"],
      use: {},
    },
    {
      name: "chromium 1440p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 }, channel: "chromium", },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "chromium 1080p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, channel: "chromium", },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "chromium 720p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 }, channel: "chromium", },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "firefox 1440p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 2560, height: 1440 }, },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "firefox 1080p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 }, },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "firefox 720p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 720 }, },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "webkit 1440p",
      use: { ...devices["Desktop Safari"], viewport: { width: 2560, height: 1440 }, },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "webkit 1080p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 }, },
      // dependencies: ["Locale files validation"],
    },
    {
      name: "webkit 720p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 }, },
      // dependencies: ["Locale files validation"],
    }
  ],
  webServer: !process.env.CI ? {
    timeout: 1000 * 1000,
    command: "yarn run start",
    url: webserverURL,
    reuseExistingServer: true,
  } : undefined,
});