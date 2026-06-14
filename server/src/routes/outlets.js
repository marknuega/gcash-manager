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

// Removing a branch is destructive (its transactions/floats/presets cascade).
// So if the branch has ANY transaction history, archive it (hide, keep data)
// instead of deleting. Only an empty branch is permanently removed.
router.delete(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { id } = req.params;
    const hist = await query("SELECT 1 FROM transactions WHERE outlet_id = $1 LIMIT 1", [id]);
    if (hist.rowCount > 0) {
      const { rows } = await query("UPDATE outlets SET archived = true WHERE id = $1 RETURNING *", [id]);
      return res.json({ ok: true, archived: true, outlet: rows[0] ? outletOut(rows[0]) : null });
    }
    await query("DELETE FROM outlets WHERE id = $1", [id]);
    res.json({ ok: true, archived: false });
  })
);

// Bring an archived branch back.
router.post(
  "/:id/restore",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { rows } = await query("UPDATE outlets SET archived = false WHERE id = $1 RETURNING *", [req.params.id]);
    if (!rows[0]) throw fail(404, "Outlet not found");
    res.json(outletOut(rows[0]));
  })
);

export default router;
