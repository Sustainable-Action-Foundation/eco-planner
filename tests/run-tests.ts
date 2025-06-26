// Transpile tests/ folder with tsc
import { execSync } from "node:child_process";

try {
  execSync("yarn tsc --project tests/tsconfig.json", { stdio: "inherit" });
}
catch (error) {
  console.error("Failed to transpile tests:", error);
  process.exit(1);
}