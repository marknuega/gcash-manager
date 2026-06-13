import { Router } from "express";
import { query } from "../db.js";
import { wrap, fail, accountOut } from "../util.js";
import { requireRole, hashPassword } from "../auth.js";

const router = Router();
router.use(requireRole("admin")); // account management is owner-only

router.post(
  "/",
  wrap(async (req, res) => {
    const { name, username, password, role, outlet } = req.body || {};
    if (!name || !username || !password) throw fail(400, "Name, username and password are required");
    const dup = await query("SELECT 1 FROM app_users WHERE lower(username)=lower($1)", [username]);
    if (dup.rowCount > 0) throw fail(409, "Username already taken.");
    const hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO app_users (username, password_hash, full_name, role, outlet_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [username.trim().toLowerCase(), hash, name.trim(), role === "admin" ? "admin" : "cashier", outlet || null]
    );
    res.status(201).json(accountOut(rows[0]));
  })
);

router.patch(
  "/:id",
  wrap(async (req, res) => {
    const { name, username, password, role, outlet } = req.body || {};
    if (username) {
      const dup = await query("SELECT 1 FROM app_users WHERE lower(username)=lower($1) AND id<>$2", [username, req.params.id]);
      if (dup.rowCount > 0) throw fail(409, "Username already taken.");
    }
    // Only re-hash the password when a new one is supplied.
    const hash = password ? await hashPassword(password) : null;
    const { rows } = await query(
      `UPDATE app_users SET
         full_name     = COALESCE($2, full_name),
         username      = COALESCE($3, username),
         password_hash = COALESCE($4, password_hash),
         role          = COALESCE($5, role),
         outlet_id     = $6
       WHERE id = $1 RETURNING *`,
      [req.params.id, name || null, username ? username.trim().toLowerCase() : null, hash, role || null, outlet || null]
    );
    if (rows.length === 0) throw fail(404, "Account not found");
    res.json(accountOut(rows[0]));
  })
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    if (req.params.id === req.user.sub) throw fail(400, "You cannot remove your own account.");
    const admins = await query("SELECT COUNT(*)::int AS n FROM app_users WHERE role='admin' AND is_active=true");
    const target = await query("SELECT role FROM app_users WHERE id=$1", [req.params.id]);
    if (target.rows[0]?.role === "admin" && admins.rows[0].n <= 1) {
      throw fail(400, "Cannot remove the last owner account.");
    }
    await query("DELETE FROM app_users WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
