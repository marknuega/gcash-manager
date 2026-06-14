import { Router } from "express";
import { query } from "../db.js";
import { wrap, outletOut, accountOut, customerOut, txnOut, presetOut } from "../util.js";

const router = Router();

// One call that returns everything the app needs, shaped exactly like the
// frontend's state. Cashiers only see their own outlet's transactions; admins
// see all. The client refetches this periodically to stay in sync.
router.get(
  "/",
  wrap(async (req, res) => {
    const isAdmin = req.user.role === "admin";
    const outletId = req.user.outlet_id;

    const [outlets, accounts, customers, floats, txns, presets] = await Promise.all([
      query("SELECT * FROM outlets ORDER BY created_at"),
      query("SELECT * FROM app_users WHERE is_active = true ORDER BY created_at"),
      query("SELECT * FROM customers ORDER BY created_at DESC"),
      query("SELECT * FROM outlet_floats"),
      isAdmin
        ? query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 2000")
        : query("SELECT * FROM transactions WHERE outlet_id = $1 ORDER BY created_at DESC LIMIT 2000", [outletId]),
      query("SELECT * FROM charge_presets ORDER BY amount"),
    ]);

    const floatsObj = {};
    for (const f of floats.rows) floatsObj[f.outlet_id] = Number(f.balance);

    res.json({
      outlets: outlets.rows.map(outletOut),
      accounts: accounts.rows.map(accountOut),
      customers: customers.rows.map(customerOut),
      floats: floatsObj,
      txns: txns.rows.map(txnOut),
      presets: presets.rows.map(presetOut),
    });
  })
);

export default router;
