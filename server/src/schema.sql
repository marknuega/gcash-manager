-- ============================================================
-- GCash Business Manager — Database Schema (PostgreSQL)
-- Idempotent: safe to run repeatedly.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Roles: admin (owner — all outlets), cashier (one outlet).
DO $$ BEGIN
  CREATE TYPE gm_user_role AS ENUM ('admin','cashier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 1. OUTLETS ----------
CREATE TABLE IF NOT EXISTS outlets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  location    text,
  color       text NOT NULL DEFAULT '#0070BA',
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. USERS / ACCOUNTS (local auth) ----------
CREATE TABLE IF NOT EXISTS app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  role          gm_user_role NOT NULL DEFAULT 'cashier',
  outlet_id     uuid REFERENCES outlets(id) ON DELETE SET NULL,  -- NULL for admin
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. CUSTOMERS ----------
CREATE TABLE IF NOT EXISTS customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  phone       text,
  address     text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 4. TRANSACTIONS ----------
CREATE TABLE IF NOT EXISTS transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL,                                  -- cash-in, cash-out, padala, pera-padala, bills, load
  amount         numeric(12,2) NOT NULL,
  fee            numeric(12,2) NOT NULL DEFAULT 0,
  outlet_id      uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  account_id     uuid REFERENCES app_users(id) ON DELETE SET NULL,
  customer_name  text,
  customer_phone text,
  note           text,
  sub_type       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_txn_outlet_date ON transactions (outlet_id, created_at DESC);

-- ---------- 5. OUTLET CASH FLOAT (one balance per outlet) ----------
CREATE TABLE IF NOT EXISTS outlet_floats (
  outlet_id   uuid PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  balance     numeric(12,2) NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 6. CHARGE PRESETS (per-outlet quick-charge cards) ----------
CREATE TABLE IF NOT EXISTS charge_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount      numeric(12,2) NOT NULL,
  charge      numeric(12,2) NOT NULL DEFAULT 0,
  outlet_id   uuid REFERENCES outlets(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
