/** 
 * The recipe parser needs aliased imports to work correctly which don't work with the regular test workflow so this file is just a workaround
 * 
 * Please fix this :pleading:
 */

import { spawnSync } from "node:child_process";
import { test, expect } from "playwright/test";

test("Recipe parser all tests pass", () => {
  const exit = spawnSync("yarn", ["tsx", "tests/files/recipe-parser.ts", "--failed"], { stdio: "pipe", shell: true });
  expect(exit.status).toBe(0);
  expect(exit.error).toBeUndefined();
  expect(exit.signal).toBeNull();
  expect(exit.output.toString()).toContain("Failed: None");
});