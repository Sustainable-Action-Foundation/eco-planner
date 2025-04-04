import "./lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const localesDir = path.join(process.cwd(), "public/locales");
const localePaths = glob.sync(`${localesDir}/**/*.json`);

localePaths.forEach(localePath => {
  if (localePath.endsWith("common.json")) return;

  const content = fs.readFileSync(localePath, "utf-8");

  try { JSON.parse(content); }
  catch (e) {
    console.error(`Error parsing JSON in ${localePath}:`, e);
    return;
  }

  const json = JSON.parse(content);

  // Sort all root levels keys in alphabetical order
  const sortedJson = Object.keys(json).sort().reduce((acc: Record<string, object>, key) => {
    acc[key] = json[key];
    return acc;
  }, {});

  // Move common first
  const withoutCommon = Object.entries(sortedJson).filter(([key]) => key !== "common");
  const common = sortedJson.common || {};

  const returnStruct = { common, ...Object.fromEntries(withoutCommon) };
  fs.writeFileSync(localePath, JSON.stringify(returnStruct, null, 2), "utf-8");
});

console.info("Locale files formatted successfully.");