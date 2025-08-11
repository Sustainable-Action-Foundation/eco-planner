import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/*
 * Load entire env file
 */
if (!fs.existsSync(".env")) {
  throw new Error("Missing .env file.");
}
const envData = fs.readFileSync(".env", "utf-8")
  .trim()
  .split(/\r?\n/)
  .filter(line => line && !line.startsWith("#")) // Ignore empty lines and comments
  .map(line => line.split("="))
  .reduce((acc: Record<string, string>, [key, value]) => {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim().replace(/^\"|\"$/g, "");
    if (trimmedKey && trimmedValue) {
      acc[trimmedKey] = trimmedValue;
    }
    return acc;
  }, {});
if (!envData || !envData.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in .env file.");
}
for (const [key, value] of Object.entries(envData)) {
  process.env[key] = value;
}

/* 
 * Prisma config 
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});