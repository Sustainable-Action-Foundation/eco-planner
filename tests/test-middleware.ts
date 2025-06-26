

import path from "node:path";
import fs from "node:fs";

// Test if the json file exists
if (!fs.existsSync(path.join("json-results", "report.json"))) {
  throw new Error("Test report file does not exist. Please run the tests first.");
}

import testReport from "../json-results/report.json" with {type: "json"};

// Pass, fail and flaky counts
console.dir(testReport.stats, { depth: null });
// Result per test
// console.dir(testReport.suites, { depth: null });