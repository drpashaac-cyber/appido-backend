import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";

export interface RlsContext {
  platform: boolean;
  tenantId?: string | null;
}

/**
 * Runs `fn` inside a transaction with the Postgres RLS context set via
 * SET LOCAL (set_config(..., is_local=true)). The app must connect as a role
 * WITHOUT BYPASSRLS (appido_app) for these policies to take effect.
 */
export async function runWithRls<T>(
  pool: Pool,
  ctx: RlsContext,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.platform', $1, true)", [ctx.platform ? "on" : "off"]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [ctx.tenantId ?? ""]);
    const tx = drizzle(client, { schema });
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
