import { colors } from "./lib/colors.ts";
import path from "node:path";
import fs from "node:fs";
import util from "node:util";

fs.writeFileSync(path.join("tests", "reporter.log"), "", { flag: "w" }); // Clear the log file at the start
const logFile = fs.createWriteStream(path.join("tests", "reporter.log"), { flags: "a" });

const __console = { ...console };
console.log = (...args: unknown[]) => {
  __console.log(...args);
  logFile.write(util.format(...args) + "\n");
};
console.error = (...args: unknown[]) => {
  __console.error(...args);
  logFile.write(util.format(...args) + "\n");
};
console.warn = (...args: unknown[]) => {
  __console.warn(...args);
  logFile.write(util.format(...args) + "\n");
};
console.info = (...args: unknown[]) => {
  __console.info(...args);
  logFile.write(util.format(...args) + "\n");
};
// Omit console.debug

// Test if the json report file exists
if (!fs.existsSync(path.join("tests", "report.json"))) {
  throw new Error("Test report file does not exist. Please run the tests first.");
}
// console.info("📂 Waiting for test results to be written to tests/report.json...");
// // To prevent reading before the file is fully written
// async function waitForValidJSON(filePath: string, maxRetries = 10): Promise<any> {
//   for (let i = 0; i < maxRetries; i++) {
//     try {
//       JSON.parse(fs.readFileSync(filePath, 'utf-8'));
//     }
//     catch (error) {
//       if (i === maxRetries - 1) throw error;
//       console.warn(`JSON file not ready, retrying... (${i + 1}/${maxRetries})`);
//       await new Promise(resolve => setTimeout(resolve, 500));
//     }
//   }
// }
// await waitForValidJSON(path.join("tests", "report.json"));
// console.info("ｉ Test results are ready for processing.");
// const { default: testReport } = await import("../tests/report.json");
const { default: testReport } = await import("../tests/report.json", { with: { type: "json" } });
// const testReport = JSON.parse(fs.readFileSync(path.join("tests", "report.json"), "utf-8"));

// Test if the reporter config file exists
if (!fs.existsSync(path.join("tests", "test-exceptions.json"))) {
  throw new Error("Reporter config file does not exist. Please create a tests/test-exceptions.json file to configure the reporter.");
}
const { default: reporterConfig } = await import("./test-exceptions.json", { with: { type: "json" } });

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
  const flakyTests = testReport.suites
    .flatMap(suite => suite.suites
      .flatMap(suite2 => suite2.specs
        .flatMap(spec => spec.tests
          .flatMap(test => ({
            test: spec.title,
            project: test.projectName,
            status: test.status
          }))
        )
      )
    )
    .filter(test => test.status === "flaky");

  console.warn(colors.yellowBG(`\n⚠️ ${flakyCount} test(s) were flaky:`));
  flakyTests.forEach((test, i) => {
    console.warn(`-[${i + 1}]`.padEnd(process.stdout.columns || 80, "-"));

    console.warn(`Test: ${colors.blue(test.test)}\nProject: ${colors.blue(test.project)}\nStatus: ${colors.yellow(test.status)}`);

    if (i !== flakyTests.length - 1) console.warn(""); // Add a separator between flaky tests
    if (i === flakyTests.length - 1) console.warn("-".repeat(process.stdout.columns || 80));
  });
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
}

// Summery of results
console.info("");
console.info(colors.blueBG(`(ｉ) Summery    Failed: ${failedTests.length}  Warning: ${nonFailingTests.length}  Flaky: ${testReport.stats.flaky}  Skipped: ${testReport.stats.skipped}  Passed: ${testReport.stats.expected}+${nonFailingTests.length}=${testReport.stats.expected + nonFailingTests.length} (incl. warnings)`));
console.info("");

if (failedTests.length > 0) {
  console.info(colors.red("❌ Some tests failed. Exiting..."));
  process.exit(1);
}
else {
  console.info(colors.green("✅ All tests passed, but some may have had warnings or flakiness."));
}