import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, presetOut } from "../util.js";

const router = Router();

// Quick-charge presets are shared business config (same cards on every device).
router.get(
  "/",
  wrap(async (req, res) => {
    const { rows } = await query("SELECT * FROM charge_presets ORDER BY amount");
    res.json(rows.map(presetOut));
  })
);

router.post(
  "/",
  wrap(async (req, res) => {
    const amount = Number((req.body || {}).amount);
    const charge = Number((req.body || {}).charge || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw fail(400, "Amount must be a positive number");
    if (!Number.isFinite(charge) || charge < 0) throw fail(400, "Charge must be zero or more");
    const { rows } = await query(
      "INSERT INTO charge_presets (amount, charge) VALUES ($1,$2) RETURNING *",
      [amount, charge]
    );
    res.status(201).json(presetOut(rows[0]));
  })
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    await query("DELETE FROM charge_presets WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
