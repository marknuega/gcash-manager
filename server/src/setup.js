// One-time database setup for managed Postgres (Neon / Render / Supabase).
// Set DATABASE_URL in server/.env, then:  cd server && node src/setup.js
// Idempotent — safe to re-run.
import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sslRequired } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const APP_URL = process.env.DATABASE_URL;
if (!APP_URL) {
  console.error("Missing DATABASE_URL in server/.env");
  process.exit(1);
}

const sslFor = (url) => (sslRequired(url) ? { rejectUnauthorized: false } : false);

async function run() {
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const app = new pg.Client({ connectionString: APP_URL, ssl: sslFor(APP_URL) });
  await app.connect();
  await app.query(schemaSql);
  await app.end();
  console.log("✓ Schema applied");
  console.log("\nDatabase ready. Next: node src/seed.js");
}

run().catch((e) => {
  console.error("Setup failed:", e.message);
  process.exit(1);
});
