import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    "project": {
      type: "string",
      short: "p",
    },
  }
});

// Transpile tests/ folder with tsc
try {
  execSync("yarn tsc --project tests/tsconfig.json", { stdio: "inherit" });
}
catch (error) {
  console.error("Failed to transpile tests:", error);
  process.exit(1);
}

// Run Playwright tests
try {
  const project = args.values.project ? `--project "${args.values.project}"` : "";
  execSync(`yarn playwright test ${project}`)
}
catch (error) {
  console.error("Failed to run tests:", error);
  process.exit(1);
}

// // Run reporter which will read the JSON report from the tests
// try {
//   execSync("tsx ./tests/reporter.ts", { stdio: "inherit" });
// }
// catch (error) {
//   console.error("Failed to run reporter:", error);
//   process.exit(1);
// }