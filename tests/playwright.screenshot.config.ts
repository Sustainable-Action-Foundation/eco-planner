import "dotenv/config";
import type { ReporterDescription } from "playwright/test";
import { defineConfig, devices } from "playwright/test";

// Allow overriding the webserver URL via environment variable, defaulting to a local port opened by testing docker compose.
export const webserverURL = process.env.BASE_URL || "http://localhost:8081";

const CI = process.env.CI ? true : false;

/**
  To run screenshot tests locally you must run: yarn screenshot
*/

export default defineConfig({
  testDir: "tests/screenshots",

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
    const reporters: ReporterDescription[] = [["html", { outputFolder: "../playwright-report-screenshots", open: "never" }]];
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

  // Configure projects for major browsers.
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium 1080p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, channel: "chromium" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "firefox 1080p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "webkit 1080p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    // Formats for screenshot tests
    // 720p Formats
    {
      name: "chromium 720p",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 }, channel: "chromium" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "firefox 720p",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 720 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "webkit 720p",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    // 1080p-vert
    {
      name: "chromium 1080p-vert",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1080, height: 1920 }, channel: "chromium" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "firefox 1080p-vert",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1080, height: 1920 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "webkit 1080p-vert",
      use: { ...devices["Desktop Safari"], viewport: { width: 1080, height: 1920 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    // // 1440p
    // {
    //   name: "chromium 1440p",
    //   use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 }, channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox 1440p",
    //   use: { ...devices["Desktop Firefox"], viewport: { width: 2560, height: 1440 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit 1440p",
    //   use: { ...devices["Desktop Safari"], viewport: { width: 2560, height: 1440 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // 4k
    {
      name: "chromium 4k",
      use: { ...devices["Desktop Chrome"], viewport: { width: 3840, height: 2160 }, channel: "chromium" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "firefox 4k",
      use: { ...devices["Desktop Firefox"], viewport: { width: 3840, height: 2160 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "webkit 4k",
      use: { ...devices["Desktop Safari"], viewport: { width: 3840, height: 2160 } },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    // // older office (4:3)
    // {
    //   name: "chromium office",
    //   use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1080 }, channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox office",
    //   use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1080 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit office",
    //   use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1080 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // // Noëlle (2880 x 1920 at 225% zoom)
    // {
    //   name: "chromium Noëlle",
    //   use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2.25, viewport: { width: 1280, height: 853 }, channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox Noëlle",
    //   use: { ...devices["Desktop Firefox"], deviceScaleFactor: 2.25, viewport: { width: 1280, height: 853 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit Noëlle",
    //   use: { ...devices["Desktop Safari"], deviceScaleFactor: 2.25, viewport: { width: 1280, height: 853 } },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // // Desktop HiDPI
    // {
    //   name: "chrome desktop HiDPI",
    //   use: { ...devices["Desktop Chrome HiDPI"], channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox desktop HiDPI",
    //   use: { ...devices["Desktop Firefox HiDPI"] },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit desktop HiDPI",
    //   use: { ...devices["Desktop Safari"] },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // iPhone 15
    // {
    //   name: "chromium iPhone 15",
    //   use: { ...devices["iPhone 15"], defaultBrowserType: "chromium", channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox iPhone 15",
    //   use: { ...devices["iPhone 15"], isMobile: false, defaultBrowserType: "firefox" }, // Firefox does not support isMobile: true ¯\_(ツ)_/¯ 
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit iPhone 15",
    //   use: { ...devices["iPhone 15"], defaultBrowserType: "webkit" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // // iPad (gen 11) landscape
    // {
    //   name: "chromium iPad (gen 11) landscape",
    //   use: { ...devices["iPad (gen 11) landscape"], defaultBrowserType: "chromium", channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox iPad (gen 11) landscape",
    //   use: { ...devices["iPad (gen 11) landscape"], isMobile: false, defaultBrowserType: "firefox" }, // Firefox does not support isMobile: true ¯\_(ツ)_/¯ 
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit iPad (gen 11) landscape",
    //   use: { ...devices["iPad (gen 11) landscape"], defaultBrowserType: "webkit" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // Galaxy S9+
    {
      name: "chromium Galaxy S9+",
      use: { ...devices["Galaxy S9+"], defaultBrowserType: "chromium", channel: "chromium" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "firefox Galaxy S9+",
      use: { ...devices["Galaxy S9+"], isMobile: false, defaultBrowserType: "firefox" }, // Firefox does not support isMobile: true ¯\_(ツ)_/¯ 
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    {
      name: "webkit Galaxy S9+",
      use: { ...devices["Galaxy S9+"], defaultBrowserType: "webkit" },
      testMatch: ["**/screenshot-tests.spec.ts"],
      dependencies: ["setup"],
    },
    // // Pixel 7
    // {
    //   name: "chromium Pixel 7",
    //   use: { ...devices["Pixel 7"], defaultBrowserType: "chromium", channel: "chromium" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "firefox Pixel 7",
    //   use: { ...devices["Pixel 7"], isMobile: false, defaultBrowserType: "firefox" }, // Firefox does not support isMobile: true ¯\_(ツ)_/¯ 
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "webkit Pixel 7",
    //   use: { ...devices["Pixel 7"], defaultBrowserType: "webkit" },
    //   testMatch: ["**/screenshot-tests.spec.ts"],
    //   dependencies: ["setup"],
    // },

  ],

  ...(
    typeof process.env.LOCAL_TESTS === "undefined"
      || process.env.LOCAL_TESTS !== "true"
      ? {
        webServer: {
          timeout: 20 * 60 * 1000, // 20 minutes; both seeding image and app image may need to be built, which might take a while with bad cache, especially on runners.
          command: "docker compose -f docker/compose.testing.yaml up --remove-orphans",
          gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }, // SIGTERM for graceful shutdown of docker compose on linux
          url: webserverURL,
          reuseExistingServer: !CI,
        },
      }
      : {
        webServer: {
          timeout: 60 * 1000,
          command: "yarn build && yarn start",
          url: webserverURL,
          reuseExistingServer: true,
        },
      }
  ),

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: CI,
});