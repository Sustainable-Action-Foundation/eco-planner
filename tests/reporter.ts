import { colors } from "./lib/colors.ts";
import path from "node:path";
import fs from "node:fs";

// Test if the json file exists
if (!fs.existsSync(path.join("json-results", "report.json"))) {
  throw new Error("Test report file does not exist. Please run the tests first.");
}

import testReport from "../json-results/report.json" with {type: "json"};

import reporterConfig from "./test-exceptions.json" with {type: "json"};

const failedCount = testReport.stats.unexpected;
const flakyCount = testReport.stats.flaky;

if (flakyCount > 0) {
  console.warn(`⚠️  ${flakyCount} flaky test(s) detected. Please investigate. This will not fail the run.`);
}

if (failedCount === 0) {
  console.info("✅ All tests passed successfully.");
  process.exit(0);
}

const badTests = testReport.suites
  .flatMap(suite => suite.specs
    .filter(spec => !spec.ok)
    .map(spec => ({
      title: spec.title,
      id: spec.id,
      warnOnFail: reporterConfig.warnOnFail?.includes(spec.title) || false,
      message: spec.tests.flatMap(test => test.results.flatMap(result => result.error.message)).at(0)
    }))
  );

const warnings = badTests.filter(test => test.warnOnFail);

if (warnings.length > 0) {
  console.warn(`\n⚠️ ${warnings.length} test(s) have warnings:`);
  warnings.forEach((test, i) => {
    console.warn("-".repeat(process.stdout.columns || 80));

    console.warn(`\u2022 ${colors.blue(test.title)} (ID: ${test.id})\n`);
    console.warn("Message from test:\n", colors.yellow(test.message));

    if (i === warnings.length - 1) console.warn("-".repeat(process.stdout.columns || 80));
  });
}

const failedTests = badTests.filter(test => !test.warnOnFail);

if (failedTests.length > 0) {
  console.error(`\n❌ ${failedTests.length} test(s) failed:`);
  failedTests.forEach((test, i) => {
    console.warn("-".repeat(process.stdout.columns || 80));

    console.error(`\u2022 ${colors.blue(test.title)} (ID: ${test.id})\n`);
    console.error("Message from test:\n", colors.red(test.message));

    if (i === warnings.length - 1) console.warn("-".repeat(process.stdout.columns || 80));
  });
  process.exit(1);
}