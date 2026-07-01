import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    // The prisma client (and its recipe helpers) import "server-only"; the
    // react-server condition resolves that to a no-op so the seed can run under tsx.
    seed: "tsx --conditions=react-server scripts/prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});