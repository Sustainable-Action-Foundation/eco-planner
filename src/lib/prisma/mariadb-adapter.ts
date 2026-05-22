import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function makeMariaDBAdapter(connectionURL: string): { adapter: PrismaMariaDb } {
  if (!connectionURL || connectionURL.trim().length === 0) throw new Error("Connection URL is required");

  const url = new URL(connectionURL);

  return {
    adapter: new PrismaMariaDb({
      host: decodeURI(url.hostname),
      port: Number(decodeURI(url.port)),
      user: decodeURI(url.username),
      password: decodeURI(url.password),
      database: decodeURI(url.pathname.slice(1)),
      // connectionLimit: 10, // 10 is the default
    }),
  };
}