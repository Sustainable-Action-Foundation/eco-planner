import { defineConfig, devices } from "playwright/test";
import { parseEnv } from "node:util";
import fs from "node:fs";

//  Load environment variables from .env file
let env: Record<string, string> = {};
if (fs.existsSync(".env")) {
  env = parseEnv(fs.readFileSync(".env", "utf-8")) as Record<string, string>;
}
process.env = Object.keys(env).length > 0 ? { ...process.env, ...env } : process.env;
env = {}; // Clear it just in case any reporter dumps the heap.

export const webserverURL = process.env.TEST_BASE_URL || "http://localhost:3000";

const CI = process.env.CI == "true";

export default defineConfig({
  testDir: "tests/compiled/",

  fullyParallel: true,
  workers: "90%",

  // One retry in case of flaky tests
  retries: 1,

  // Reporter to use
  reporter: [
    ...(CI ?
      [["github"]]
      :
      [["html", { open: "never" }]]
    ) as [string, object][],

    ["json", { outputFile: "tests/report.json" }],
    ["list"],
  ],
  // reporter: "list",

  // Global use
  use: {
    // Base URL to use in actions like `await page.goto("/")`.
    baseURL: webserverURL,

    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
  },

  globalTeardown: "./tests/compiled/lib/global.teardown.js",

  // Configure projects for major browsers.
  projects: [
    {
      name: "Locale files validation",
      testMatch: ["**/locale-files.js"],
      retries: 0, // File reading can't be flaky, so no retries needed.
      use: {},
    },
    {
      name: "chromium 1440p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 }, channel: "chromium", },
    },
    {
      name: "chromium 1080p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, channel: "chromium", },
    },
    {
      name: "chromium 720p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 }, channel: "chromium", },
    },
    {
      name: "firefox 1440p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 2560, height: 1440 }, },
    },
    {
      name: "firefox 1080p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 }, },
    },
    {
      name: "firefox 720p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 720 }, },
    },
    {
      name: "webkit 1440p",
      use: { ...devices["Desktop Safari"], viewport: { width: 2560, height: 1440 }, },
    },
    {
      name: "webkit 1080p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 }, },
    },
    {
      name: "webkit 720p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 }, },
    }
  ],

  // Running locally starts next.js server from here. Make sure to have built the app first.
  webServer: CI ? undefined : {
    timeout: 1000 * 1000,
    command: "yarn run start",
    url: webserverURL,
    reuseExistingServer: true,
  },

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: CI,
});