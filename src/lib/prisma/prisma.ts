import "dotenv/config";
import { makeMariaDBAdapter } from "@/lib/prisma/mariadb-adapter";
import { PrismaClient } from "../../../.prisma/generated";
export * from "../../../.prisma/generated";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not defined");

export const prisma = globalForPrisma.prisma ?? new PrismaClient(makeMariaDBAdapter(DATABASE_URL));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const disconnect = () => {
  prisma.$disconnect()
    .catch((err: unknown) => {
      console.error("Error disconnecting Prisma Client:", err);
    });
};
process.on("beforeExit", disconnect);
process.on("exit", disconnect);
process.on("uncaughtException", disconnect);