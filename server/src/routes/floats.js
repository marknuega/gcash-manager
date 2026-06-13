import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail } from "../util.js";

const router = Router();

// Manually set an outlet's float (e.g. after replenishing cash).
router.put(
  "/:outletId",
  wrap(async (req, res) => {
    const { outletId } = req.params;
    const balance = Number(req.body?.balance);
    if (!Number.isFinite(balance)) throw fail(400, "Balance must be a number");
    if (req.user.role === "cashier" && req.user.outlet_id !== outletId) {
      throw fail(403, "You can only adjust your own outlet's float");
    }
    const { rows } = await query(
      `INSERT INTO outlet_floats (outlet_id, balance) VALUES ($1, $2)
       ON CONFLICT (outlet_id) DO UPDATE SET balance = $2, updated_at = now()
       RETURNING balance`,
      [outletId, balance]
    );
    res.json({ outletId, float: Number(rows[0].balance) });
  })
);

export default router;
