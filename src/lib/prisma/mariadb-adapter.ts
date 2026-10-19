import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Pool settings read from the `DATABASE_URL` query string, using Prisma's
 * conventional parameter names so the same URL works for the Prisma CLI:
 *
 * | Param             | Unit    | Driver option     | Default when absent (driver default) |
 * | ----------------- | ------- | ----------------- | ------------------------------------ |
 * | `connection_limit`| count   | `connectionLimit` | 10                                   |
 * | `pool_timeout`    | seconds | `acquireTimeout`  | 10 s                                 |
 * | `connect_timeout` | seconds | `connectTimeout`  | 1 s (capped at `acquireTimeout`)     |
 *
 * Absent params leave the driver defaults in place, so a plain URL behaves as before.
 * The mariadb pool is fixed-size (`minimumIdle` defaults to `connectionLimit`): it
 * opens `connection_limit` connections and keeps them open, so size it for the box.
 * Per-environment values are documented in `caching.md` ("Database pool").
 */
function readPoolParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`DATABASE_URL parameter "${name}" must be a positive integer, got "${raw}"`);
  }
  return value;
}

export function makeMariaDBAdapter(connectionURL: string): { adapter: PrismaMariaDb } {
  if (!connectionURL || connectionURL.trim().length === 0) throw new Error("Connection URL is required");

  const url = new URL(connectionURL);

  const connectionLimit = readPoolParam(url, "connection_limit");
  const poolTimeout = readPoolParam(url, "pool_timeout");
  const connectTimeout = readPoolParam(url, "connect_timeout");

  return {
    adapter: new PrismaMariaDb({
      host: decodeURI(url.hostname),
      port: Number(decodeURI(url.port)),
      user: decodeURI(url.username),
      password: decodeURI(url.password),
      database: decodeURI(url.pathname.slice(1)),
      ...(connectionLimit !== undefined ? { connectionLimit } : {}),
      ...(poolTimeout !== undefined ? { acquireTimeout: poolTimeout * 1000 } : {}),
      ...(connectTimeout !== undefined ? { connectTimeout: connectTimeout * 1000 } : {}),
    }),
  };
}
