import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, outletOut } from "../util.js";
import { requireRole } from "../auth.js";

const router = Router();

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
    // start the new outlet's float at zero
    await query("INSERT INTO outlet_floats (outlet_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING", [rows[0].id]);
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
