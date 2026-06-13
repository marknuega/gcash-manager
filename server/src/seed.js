// Seed the database with starter data: outlets, an owner/admin login, one
// cashier per outlet, their floats, and a few demo customers.
// Run once after db:setup:  cd server && node src/seed.js
// Idempotent — skips anything that already exists (matched by name/username).
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "./db.js";
import { hashPassword } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD || "admin123";
const CASHIER_PW = "pass4645";

const OUTLETS = [
  { name: "Divisoria Branch", location: "Divisoria, Manila", color: "#0070BA", float: 15000, cashier: { name: "Maria Santos", username: "maria" } },
  { name: "Cubao Branch", location: "Cubao, QC", color: "#00A859", float: 12000, cashier: { name: "Juan dela Cruz", username: "juan" } },
  { name: "Caloocan Branch", location: "Caloocan City", color: "#7C3AED", float: 18000, cashier: { name: "Ana Reyes", username: "ana" } },
  { name: "Pasay Branch", location: "Pasay City", color: "#F5A623", float: 10000, cashier: { name: "Pedro Garcia", username: "pedro" } },
];

const CUSTOMERS = [
  { name: "Rosa Lim", phone: "09161111111", address: "Tondo, Manila", note: "Regular" },
  { name: "Ben Tan", phone: "09272222222", address: "Makati", note: "" },
  { name: "Lita Cruz", phone: "09383333333", address: "Pasig", note: "Senior" },
];

async function upsertUser({ username, full_name, role, outlet_id, password }) {
  const existing = await query("SELECT id FROM app_users WHERE lower(username)=lower($1)", [username]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO app_users (username, password_hash, full_name, role, outlet_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [username, hash, full_name, role, outlet_id]
  );
  return rows[0].id;
}

async function run() {
  // Admin / owner (no outlet)
  await upsertUser({ username: "admin", full_name: "Owner / Admin", role: "admin", outlet_id: null, password: ADMIN_PW });

  for (const o of OUTLETS) {
    let outletId;
    const existing = await query("SELECT id FROM outlets WHERE name=$1", [o.name]);
    if (existing.rowCount > 0) {
      outletId = existing.rows[0].id;
    } else {
      const { rows } = await query(
        "INSERT INTO outlets (name, location, color) VALUES ($1,$2,$3) RETURNING id",
        [o.name, o.location, o.color]
      );
      outletId = rows[0].id;
    }
    await query(
      `INSERT INTO outlet_floats (outlet_id, balance) VALUES ($1,$2)
       ON CONFLICT (outlet_id) DO NOTHING`,
      [outletId, o.float]
    );
    await upsertUser({
      username: o.cashier.username,
      full_name: o.cashier.name,
      role: "cashier",
      outlet_id: outletId,
      password: CASHIER_PW,
    });
  }

  for (const c of CUSTOMERS) {
    const existing = await query("SELECT id FROM customers WHERE name=$1 AND phone=$2", [c.name, c.phone]);
    if (existing.rowCount === 0) {
      await query("INSERT INTO customers (name, phone, address, note) VALUES ($1,$2,$3,$4)", [c.name, c.phone, c.address, c.note]);
    }
  }

  console.log("✓ Seed complete\n");
  console.log("Logins created:");
  console.log(`  admin / ${ADMIN_PW}      (Owner — all outlets)`);
  for (const o of OUTLETS) console.log(`  ${o.cashier.username} / ${CASHIER_PW}   (${o.name})`);
  console.log("\nChange these passwords from the Accounts tab after first login.");
  await pool.end();
}

run().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
