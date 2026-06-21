// Bootstrap (or repair) a platform owner account with a password, so the owner console is
// loginable without depending on email delivery.
//
//   node dist/create-owner.js <email> <password> [name]
//   # or via env: OWNER_EMAIL=… OWNER_PASSWORD=… [OWNER_NAME=…] node dist/create-owner.js
//
// Idempotent: if the email already exists it is promoted to an active password-owner and the
// password is reset. Run after migrations.
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";
import { loadConfig } from "@appido/config";

async function run(): Promise<void> {
  const cfg = loadConfig();
  const email = (process.argv[2] || process.env.OWNER_EMAIL || cfg.OWNER_EMAIL || "").toLowerCase().trim();
  const password = process.argv[3] || process.env.OWNER_PASSWORD || "";
  const name = (process.argv[4] || process.env.OWNER_NAME || "Owner").trim();

  if (!email || !password) {
    console.error("Usage: node dist/create-owner.js <email> <password> [name]   (or OWNER_EMAIL / OWNER_PASSWORD env)");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: cfg.DATABASE_URL });
  try {
    const passwordHash = await hash(password);
    const res = await pool.query(
      `INSERT INTO users (email, name, role, status, method, password_hash)
       VALUES ($1, $2, 'owner', 'active', 'password', $3)
       ON CONFLICT (email) DO UPDATE
         SET role = 'owner', status = 'active', method = 'password',
             password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
       RETURNING id, (xmax = 0) AS created`,
      [email, name, passwordHash],
    );
    const row = res.rows[0] as { id: string; created: boolean };
    console.log(`${row.created ? "Created" : "Updated"} platform owner: ${email}`);
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error("create-owner failed:", e);
  process.exit(1);
});
