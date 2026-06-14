// ------------------------------------------------------------
// Restore from a backup JSON produced by src/backup.js.
//
//   cd server && npm run restore -- backups/backup-XXXX.json
//
// SAFE BY DEFAULT: it MERGES — inserts rows that are missing and never
// overwrites or deletes existing rows (INSERT ... ON CONFLICT DO NOTHING).
// So it recovers lost records without clobbering current data. After a total
// loss the tables are empty, so everything is restored.
// ------------------------------------------------------------
import { pool } from "./db.js";
import fs from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run restore -- <path-to-backup.json>");
  process.exit(1);
}

async function run() {
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  const data = JSON.parse(raw);
  const order = data.tableOrder || Object.keys(data.tables);

  let inserted = 0;
  for (const table of order) {
    const rows = data.tables[table] || [];
    for (const row of rows) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
      const res = await pool.query(
        `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        cols.map((c) => row[c])
      );
      inserted += res.rowCount;
    }
    console.log(`  ${table}: ${rows.length} in file`);
  }

  console.log(`✓ Restore complete. ${inserted} new row(s) inserted (existing rows left untouched).`);
  await pool.end();
}

run().catch((e) => {
  console.error("Restore failed:", e.message);
  process.exit(1);
});
