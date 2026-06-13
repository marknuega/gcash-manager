import { Router } from "express";
import { tx } from "../db.js";
import { wrap, fail, txnOut, FLOAT_EFFECT } from "../util.js";

const router = Router();

// Record a transaction and move the outlet's float atomically.
// Returns { txn, float } so the client can update both at once.
router.post(
  "/",
  wrap(async (req, res) => {
    const b = req.body || {};
    const type = b.type;
    const amount = Number(b.amount);
    const fee = Number(b.fee || 0);
    if (!type || !(type in FLOAT_EFFECT)) throw fail(400, "Unknown service type");
    if (!Number.isFinite(amount) || amount <= 0) throw fail(400, "Amount must be a positive number");

    // Cashiers can only post to their own outlet.
    const outletId = req.user.role === "cashier" ? req.user.outlet_id : b.outlet;
    if (!outletId) throw fail(400, "Outlet is required");
    const accountId = req.user.role === "cashier" ? req.user.sub : b.accountId || req.user.sub;

    const result = await tx(async (client) => {
      const ins = await client.query(
        `INSERT INTO transactions
           (type, amount, fee, outlet_id, account_id, customer_name, customer_phone, note, sub_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [type, amount, fee, outletId, accountId, b.customerName || null, b.customerPhone || null, b.note || null, b.subType || null]
      );
      const delta = FLOAT_EFFECT[type] * amount + fee;
      const upd = await client.query(
        `INSERT INTO outlet_floats (outlet_id, balance) VALUES ($1, $2)
         ON CONFLICT (outlet_id)
         DO UPDATE SET balance = outlet_floats.balance + $2, updated_at = now()
         RETURNING balance`,
        [outletId, delta]
      );
      return { txn: ins.rows[0], balance: Number(upd.rows[0].balance) };
    });

    res.status(201).json({ txn: txnOut(result.txn), outletId, float: result.balance });
  })
);

export default router;
