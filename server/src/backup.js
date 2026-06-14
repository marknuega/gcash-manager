// ------------------------------------------------------------
// Logical backup: export every table to a timestamped JSON file.
// Self-contained (no pg_dump needed), so it runs anywhere Node + the
// DATABASE_URL are available.
//
//   cd server && npm run backup        (reads DATABASE_URL from server/.env)
//
// Files land in server/backups/backup-<timestamp>.json. Keep copies off the
// machine (cloud drive / email) for real safety. Restore with src/restore.js.
// ------------------------------------------------------------
import { pool } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FK-safe order (parents first) — restore replays in this same order.
const TABLES = ["outlets", "app_users", "customers", "transactions", "outlet_floats", "charge_presets"];

async function run() {
  const dir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(dir, { recursive: true });

  const data = { takenAt: new Date().toISOString(), tableOrder: TABLES, tables: {} };
  for (const t of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${t}`);
    data.tables[t] = rows;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

  const counts = TABLES.map((t) => `${t}=${data.tables[t].length}`).join(", ");
  console.log(`✓ Backup written: ${file}`);
  console.log(`  ${counts}`);
  await pool.end();
}

run().catch((e) => {
  console.error("Backup failed:", e.message);
  process.exit(1);
});
