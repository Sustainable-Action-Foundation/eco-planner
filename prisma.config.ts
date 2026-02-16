import 'dotenv/config';
import path from "node:path";
import { defineConfig } from "prisma/config";

/* 
 * Prisma config 
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  migrations: {
    seed: "tsx prisma/seed.ts",
    path: path.join("prisma", "migrations"),
  },
});