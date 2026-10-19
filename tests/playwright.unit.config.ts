import type { ReporterDescription } from "playwright/test";
import { defineConfig } from "playwright/test";
import { boolEnv } from "./lib/env";

const CI = boolEnv("CI", false);

export default defineConfig({
  testDir: "./",
  testMatch: "unit/**/*.test.ts",
  workers: "80%",
  retries: 0,
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  // Reporter to use
  reporter: (() => {
    const reporters: ReporterDescription[] = [["html", { outputFolder: "../playwright-report-unit", open: "never" }]];
    if (CI)
      reporters.push(["github"]);
    else
      reporters.push(["dot"]);

    return reporters;
  })(),
  use: {
    locale: "cimode",
    timezoneId: "Europe/Stockholm",
    actionTimeout: 5 * 1000,
  },
  projects: [
    {
      name: "unit",
      retries: 0, // Deterministic, no browser; a flaky unit test is a bug
    },
    {
      name: "Upstream cache handler unit tests",
      testMatch: ["unit/upstream-cache-handler.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
  ],
});
