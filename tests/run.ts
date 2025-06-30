import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    "help": {
      type: "boolean",
      short: "h",
      description: "Show this help message and exit",
    },
    "project": {
      type: "string",
      short: "p",
    },
    "verbose": {
      type: "boolean",
      short: "v",
      default: false,
      description: "Log all stout and stderr output from the tests",
    }
  }
});

// Display help if --help or -h is passed
if (args.values.help) {
  console.info(`
Preferred usage: 
  yarn test:run [--project | -p <playwright project name>] [--verbose | -v]
Also supported:
  # with node > 22.7
  node tests/run.ts [--project | -p <playwright project name>] [--verbose | -v]
  # with tsx -- which is a project dependency (checked 2025-06-30)
  yarn tsx tests/run.ts [--project | -p <playwright project name>] [--verbose | -v]

Arguments:
  --help, -h: Show this help message and exit
  --project, -p <playwright project name>: Specify the Playwright project to run
  --verbose, -v: Log all stdout and stderr output from the tests

Runs Playwright tests on transpiled TypeScript files in the tests/ folder and runs it through a configurable reporter. 
  `.trim());
  process.exit(0);
}

// Transpile tests/ folder with tsc
try {
  console.info("Transpiling tests/ folder with TypeScript compiler...");
  execSync("yarn tsc --project tests/tsconfig.json", { stdio: "inherit" });
  console.info("Transpilation complete.");
}
catch (error) {
  console.error("Failed to transpile tests:", error);
  process.exit(1);
}

// Run Playwright tests
try {
  console.info("Running Playwright tests..." + (!args.values.verbose ? " If you wish to see the stdout of the tests, use the --verbose flag." : ""));
  const project = args.values.project ? `--project "${args.values.project}"` : "";
  execSync(`tsx  node_modules/playwright/cli.js test ${project}`, args.values.verbose ? { stdio: "inherit" } : {});
}
catch (error) {
  console.warn("One or more tests failed. Continuing to run reporter...");
}

// Run reporter which will read the JSON report from the tests
try {
  console.info("Running reporter to process test results...");
  execSync("tsx ./tests/reporter.ts", { stdio: "inherit" });
}
catch (error) {
  console.error("Failed to run reporter:", error);
  process.exit(1);
}