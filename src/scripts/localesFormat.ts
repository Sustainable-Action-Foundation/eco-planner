import "./lib/console.ts";
import { colors } from "./lib/colors.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const localesDir = path.join(process.cwd(), "public/locales");
const localePaths = glob.sync(`${localesDir}/**/*.json`);

console.debug(localePaths);