import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, outletOut } from "../util.js";
import { requireRole } from "../auth.js";

const router = Router();

const DEFAULT_PRESETS = [[100,5],[200,10],[300,10],[500,10],[1000,15],[1500,20],[2000,30],[3000,45],[5000,75]];

// Outlets are managed by the owner only.
router.post(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { name, location, color } = req.body || {};
    if (!name || !name.trim()) throw fail(400, "Outlet name is required");
    const { rows } = await query(
      "INSERT INTO outlets (name, location, color) VALUES ($1,$2,$3) RETURNING *",
      [name.trim(), location || null, color || "#0070BA"]
    );
    const outletId = rows[0].id;
    // start the new outlet's float at zero
    await query("INSERT INTO outlet_floats (outlet_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING", [outletId]);
    // give the new branch its own default quick-charge presets
    for (const [amount, charge] of DEFAULT_PRESETS) {
      await query("INSERT INTO charge_presets (amount, charge, outlet_id) VALUES ($1,$2,$3)", [amount, charge, outletId]);
    }
    res.status(201).json(outletOut(rows[0]));
  })
);

router.delete(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    await query("DELETE FROM outlets WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
