import "server-only";
import "dotenv/config";
import { makeMariaDBAdapter } from "@/lib/prisma/mariadb-adapter";
import { PrismaClient } from "../../../prisma/generated/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
let prismaClient = globalForPrisma.prisma;

const initPrisma = () => {
  if (prismaClient) return prismaClient;

  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not defined");

  prismaClient = new PrismaClient(makeMariaDBAdapter(DATABASE_URL));

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;

  return prismaClient;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = initPrisma();
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const disconnect = () => {
  const client = prismaClient;
  if (!client) return;

  client.$disconnect()
    .catch((err: unknown) => {
      console.error("Error disconnecting Prisma Client:", err);
    });
};
process.on("beforeExit", disconnect);
process.on("exit", disconnect);
process.on("uncaughtException", disconnect);