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
      name: "Locale files validation",
      testMatch: ["unit/locale-files.test.ts"],
      retries: 0, // File reading can't be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Recipe unit tests",
      testMatch: ["unit/recipe-unit.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Action fields unit tests",
      testMatch: ["unit/action-fields.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Goal CSV parsing unit tests",
      testMatch: ["unit/parse-goal-csv.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Orgless access unit tests",
      testMatch: ["unit/orgless-access.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
    {
      name: "Table catalog unit tests",
      testMatch: ["unit/table-catalog.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
    {
      name: "PxWeb table list unit tests",
      testMatch: ["unit/px-web-tables.test.ts"],
      retries: 0, // These tests are deterministic and should not be flaky, so no retries needed.
      use: {},
    },
  ],
});
