import "dotenv/config";
import type { ReporterDescription } from "playwright/test";
import { defineConfig, devices } from "playwright/test";
import { boolEnv } from "./lib/env";

// Allow overriding the webserver URL via environment variable, defaulting to a local port opened by testing docker compose.
export const webserverURL = process.env.BASE_URL || "http://localhost:8081";

const CI = boolEnv("CI", false);

export default defineConfig({
  testDir: "./",
  testMatch: "e2e/**/*.spec.ts",

  // fullyParallel: true,
  workers: "80%",

  // One retry in case of flaky tests
  retries: 1,

  timeout: 60 * 1000, // Max time one test can run for

  expect: {
    timeout: 10 * 1000, // Max time expect() should wait for the condition to be met.
  },

  // Reporter to use
  reporter: (() => {
    const reporters: ReporterDescription[] = [["html", { outputFolder: "../playwright-report-e2e", open: "never" }]];
    if (CI)
      reporters.push(["github"]);
    else
      reporters.push(["dot"]);

    return reporters;
  })(),

  // Stop docker containers after tests are done
  globalTeardown: "global.teardown.ts",

  // Global use
  use: {
    // Base URL to use in actions like `await page.goto("/")`.
    baseURL: webserverURL,

    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    locale: "cimode",
    timezoneId: "Europe/Stockholm",

    // Shorter timeouts for actions to make tests that will fail, fail faster. 
    actionTimeout: 5 * 1000, // Timeout for click, fill etc.
  },

  // Web server
  ...(
    !boolEnv("SAF_LOCAL_TESTS")
      ? {
        webServer: {
          timeout: 20 * 60 * 1000, // 20 minutes; both seeding image and app image may need to be built, which might take a while with bad cache, especially on runners.
          command: "BUILDKIT_PROGRESS=plain docker compose --verbose -f ../docker/compose.testing.yaml up --remove-orphans --build",
          gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }, // SIGTERM for graceful shutdown of docker compose on linux
          url: webserverURL,
          reuseExistingServer: !CI,
        },
      }
      : {
        webServer: {
          timeout: 60 * 1000,
          command: !boolEnv("SAF_SKIP_BUILD")
            ? "yarn build && yarn start"
            : "yarn start",
          url: webserverURL,
          reuseExistingServer: true,
        },
      }
  ),

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: CI,

  // Configure projects for major browsers.
  projects: [
    {
      name: "setup",
      testMatch: "*.setup.ts",
    },
    {
      name: "chromium 1080p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, channel: "chromium" },
      dependencies: ["setup"],
    },
    {
      name: "firefox 1080p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 } },
      dependencies: ["setup"],
    },
    {
      name: "webkit 1080p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 } },
      dependencies: ["setup"],
    },
  ],
});