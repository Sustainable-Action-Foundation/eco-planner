import fs from "node:fs";

/*
 * Test results get piped to this file and can be filtered and written to a desired file.
 */

let inputData = "";

process.stdin.setEncoding('utf8');

process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  if (!inputData) {
    console.error("No input data received.");
    process.exit(1);
  }

  const firstOpenBracket = inputData.indexOf("{");
  const lastCloseBracket = inputData.lastIndexOf("}");
  const slicedInput = inputData.slice(firstOpenBracket, lastCloseBracket + 1);

  let testResults;
  try {
    testResults = JSON.parse(slicedInput);
  } catch (error) {
    console.error("Error parsing test results as JSON:\n\n", error);
    process.exit(1);
  }

  // fs.writeFileSync("test-results.json", JSON.stringify(testResults, null, 2), "utf8");
  // const failedTests = testResults.suites.flatMap(suite => suite.specs.filter(spec => !spec.ok))

  // console.dir(failedTests[0].tests);

  // Explicitly exit to ensure clean shutdown
  process.exit(0);
});

// Handle broken pipe gracefully
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
});