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

// Allow overriding the webserver URL via environment variable, defaulting to a local port opened by testing docker compose.
export const webserverURL = process.env.BASE_URL || "http://localhost:8081";

const CI = process.env.CI ? true : false;

export default defineConfig({
  testDir: "tests/",

  // fullyParallel: true,
  workers: "50%",

  // One retry in case of flaky tests
  retries: 1,

  timeout: 60 * 1000, // Max time one test can run for

  expect: {
    timeout: 10 * 1000, // Max time expect() should wait for the condition to be met.
  },

  // Reporter to use
  reporter: [
    ...(CI ?
      [["github"]]
      :
      [
        ["dot"],
        ["html", { open: "never" }],
      ]
    ) as [string, object][],

    ["json", { outputFile: "tests/report.json" }],
    ["list"],
  ],
  // reporter: "list",

  // Stop docker containers after tests are done
  globalTeardown: "./tests/global.teardown.ts",

  // Global use
  use: {
    // Base URL to use in actions like `await page.goto("/")`.
    baseURL: webserverURL,

    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",

    // Shorter timeouts for actions to make tests that will fail, fail faster. 
    actionTimeout: 5 * 1000, // Timeout for click, fill etc.
  },

  // Configure projects for major browsers.
  projects: [
    { 
      name: 'setup', 
      testMatch: /.*\.setup\.ts/ },
    {
      name: "Locale files validation",
      testMatch: ["**/locale-files.ts"],
      retries: 0, // File reading can't be flaky, so no retries needed.
      use: {},
    },
    {
      name: "chromium 1080p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, channel: "chromium"},
      dependencies: ["setup"],
    },
    {
      name: "firefox 1080p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 }},
      dependencies: ["setup"],
    },
    {
      name: "webkit 1080p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 } },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    timeout: 20 * 60 * 1000, // 20 minutes; both seeding image and app image may need to be built, which might take a while with bad cache, especially on runners.
    command: "docker compose -f docker/compose.testing.yaml up --remove-orphans",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }, // SIGTERM for graceful shutdown of docker compose on linux
    url: webserverURL,
    reuseExistingServer: !CI,
  },

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: CI,
});