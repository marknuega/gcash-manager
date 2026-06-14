import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, presetOut } from "../util.js";

const router = Router();

// Quick-charge presets are per outlet. Owner sees/edits every branch's set;
// a cashier is locked to their own outlet.
router.get(
  "/",
  wrap(async (req, res) => {
    const isAdmin = req.user.role === "admin";
    const { rows } = isAdmin
      ? await query("SELECT * FROM charge_presets ORDER BY outlet_id, amount")
      : await query("SELECT * FROM charge_presets WHERE outlet_id = $1 ORDER BY amount", [req.user.outlet_id]);
    res.json(rows.map(presetOut));
  })
);

router.post(
  "/",
  wrap(async (req, res) => {
    const b = req.body || {};
    const amount = Number(b.amount);
    const charge = Number(b.charge || 0);
    const outletId = req.user.role === "cashier" ? req.user.outlet_id : b.outlet;
    if (!outletId) throw fail(400, "Outlet is required");
    if (!Number.isFinite(amount) || amount <= 0) throw fail(400, "Amount must be a positive number");
    if (!Number.isFinite(charge) || charge < 0) throw fail(400, "Charge must be zero or more");
    const { rows } = await query(
      "INSERT INTO charge_presets (amount, charge, outlet_id) VALUES ($1,$2,$3) RETURNING *",
      [amount, charge, outletId]
    );
    res.status(201).json(presetOut(rows[0]));
  })
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    if (req.user.role === "cashier") {
      await query("DELETE FROM charge_presets WHERE id = $1 AND outlet_id = $2", [req.params.id, req.user.outlet_id]);
    } else {
      await query("DELETE FROM charge_presets WHERE id = $1", [req.params.id]);
    }
    res.json({ ok: true });
  })
);

export default router;
