import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, customerOut } from "../util.js";

const router = Router();

router.post(
  "/",
  wrap(async (req, res) => {
    const { name, phone, address, note } = req.body || {};
    if (!name || !name.trim()) throw fail(400, "Name is required");
    const { rows } = await query(
      "INSERT INTO customers (name, phone, address, note) VALUES ($1,$2,$3,$4) RETURNING *",
      [name.trim(), phone || null, address || null, note || null]
    );
    res.status(201).json(customerOut(rows[0]));
  })
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    await query("DELETE FROM customers WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
