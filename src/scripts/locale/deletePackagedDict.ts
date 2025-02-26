import fs from "fs";
import { collectedDictionaryPath } from "./dictHandler";

fs.unlinkSync(collectedDictionaryPath);
