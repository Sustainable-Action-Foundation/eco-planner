import { colors } from "./lib/colors.ts";
import path from "node:path";
import fs from "node:fs";

// Test if the json file exists
if (!fs.existsSync(path.join("json-results", "report.json"))) {
  throw new Error("Test report file does not exist. Please run the tests first.");
}
import testReport from "../json-results/report.json" with {type: "json"};

// Test if the reporter config file exists
if (!fs.existsSync(path.join("tests", "test-exceptions.json"))) {
  throw new Error("Reporter config file does not exist. Please create a tests/test-exceptions.json file to configure the reporter.");
}
import reporterConfig from "./test-exceptions.json" with {type: "json"};

// Reporter config validation
if (!reporterConfig || !reporterConfig.warnOnFail || !Array.isArray(reporterConfig.warnOnFail)) {
  throw new Error("Invalid reporter config file. Please ensure it contains a 'warnOnFail' array with the test titles which should not stop the test run.");
}

const failedCount = testReport.stats.unexpected;
const flakyCount = testReport.stats.flaky;

if (failedCount === 0 && flakyCount === 0) {
  console.info(colors.green("✅ All tests passed successfully."));
  process.exit(0);
}

if (flakyCount > 0) {
  const flakyTests = testReport.suites.flatMap(suite => suite)
  console.dir(flakyTests, { depth: null });
}

/** All failed tests, may contain non failing tests as well. */
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

// Tests that fail in playwright but are configured to not fail the test run
const nonFailingTests = badTests.filter(test => test.warnOnFail);
if (nonFailingTests.length > 0) {
  console.warn(colors.yellowBG(`\n⚠️ ${nonFailingTests.length} test(s) have warnings:`));

  nonFailingTests.forEach((test, i) => {
    console.warn(`-[${i + 1}]`.padEnd(process.stdout.columns || 80, "-"));

    console.warn(`Test:\n ${colors.blue(test.title)} (ID: ${test.id})\n`);
    console.warn("Message from test:\n", colors.yellow(test.message));

    if (i !== nonFailingTests.length - 1) console.warn(""); // Add a separator between warnings
    if (i === nonFailingTests.length - 1) console.warn("-".repeat(process.stdout.columns || 80));
  });
}

// Tests that fail in playwright and are not configured to not fail the test run i.e. regular unit tests.
const failedTests = badTests.filter(test => !test.warnOnFail);
if (failedTests.length > 0) {
  console.error(colors.redBG(`\n❌ ${failedTests.length} test(s) failed:`));

  failedTests.forEach((test, i) => {
    console.error(`-[${i + 1}]`.padEnd(process.stdout.columns || 80, "-"));

    console.error(`Test:\n ${colors.blue(test.title)} (ID: ${test.id})\n`);
    console.error("Message from test:\n", colors.red(test.message));

    if (i !== failedTests.length - 1) console.error(""); // Add a separator between tests
    if (i === nonFailingTests.length - 1) console.error("-".repeat(process.stdout.columns || 80));
  });
  process.exit(1);
}

console.info(colors.green("✅ All tests passed, but some may have had warnings."));