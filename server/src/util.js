// Wrap an async route handler so thrown errors become a clean JSON error
// (with the status the handler set) instead of crashing the process.
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[${req.method} ${req.originalUrl}]`, err.message);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: err.publicMessage || "Server error" });
  });

// Throw a request error with an HTTP status + user-facing message.
export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  e.publicMessage = message;
  return e;
}

// ── shape DB rows into the exact objects the frontend already uses ──
export const outletOut = (r) => ({ id: r.id, name: r.name, location: r.location, color: r.color });

export const accountOut = (r) => ({
  id: r.id,
  name: r.full_name,
  username: r.username,
  role: r.role,
  outlet: r.outlet_id, // null for admin
});

export const customerOut = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || "",
  address: r.address || "",
  note: r.note || "",
});

export const txnOut = (r) => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount),
  fee: Number(r.fee),
  outlet: r.outlet_id,
  accountId: r.account_id,
  customerName: r.customer_name || "",
  customerPhone: r.customer_phone || "",
  note: r.note || "",
  subType: r.sub_type || "",
  date: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

// How each service type moves the outlet's cash float. Mirrors SERVICE_TYPES on
// the client; computed server-side so the float is authoritative.
export const FLOAT_EFFECT = {
  "cash-in": +1,
  "cash-out": -1,
  padala: -1,
  "pera-padala": -1,
  bills: -1,
  load: -1,
};
