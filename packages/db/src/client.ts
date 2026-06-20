import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  pool: Pool;
}

/** Runtime connection. Pass the APP (NOBYPASSRLS) URL so RLS policies apply.
 * Pool is tunable via env so it can be sized per deployment (replicas x max must stay under the
 * server's max_connections — put PgBouncer in front for high replica counts). SSL is taken from the
 * connection string (e.g. ?sslmode=require on managed Postgres). */
export function createDb(connectionString: string): DbHandle {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const pool = new Pool({
    connectionString,
    max: num(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: num(process.env.DB_POOL_IDLE_MS, 30_000),
    connectionTimeoutMillis: num(process.env.DB_POOL_CONN_TIMEOUT_MS, 10_000),
    keepAlive: true, // avoid idle-connection drops behind load balancers / NAT
  });
  // Never let a background connection error crash the process; log and let the pool recycle it.
  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("pg pool error (recovered):", err.message);
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
