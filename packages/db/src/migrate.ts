// Tiny, framework-agnostic SQL migration runner. Applies ./migrations/*.sql in
// order inside a transaction, tracking applied files in _migrations. Idempotent.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { loadConfig } from "@appido/config";

async function run(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  const pool = new Pool({ connectionString: DATABASE_URL });
  const dir = join(__dirname, "..", "migrations");
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await pool.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (applied.rowCount) {
      // eslint-disable-next-line no-console
      console.log("skip", file);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    // eslint-disable-next-line no-console
    console.log("apply", file);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      await pool.end();
      throw err;
    }
  }
  await pool.end();
  // eslint-disable-next-line no-console
  console.log("migrations complete");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
