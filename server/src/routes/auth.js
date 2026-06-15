// import { Router } from "express";
// import rateLimit from "express-rate-limit";
// import { login, signToken, publicUser } from "../auth.js";
// import { wrap, fail } from "../util.js";

// const router = Router();

// // Throttle login attempts a little to slow brute force.
// const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

// router.post(
//   "/login",
//   loginLimiter,
//   wrap(async (req, res) => {
//     const { username, password } = req.body || {};
//     if (!username || !password) throw fail(400, "Username and password are required");
//     const user = await login(username, password);
//     if (!user) throw fail(401, "Invalid username or password.");
//     res.json({ token: signToken(user), user: publicUser(user) });
//   })
// );

// export default router;


import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, signToken, publicUser, requireAuth } from "../auth.js";
import { query } from "../db.js";
import { wrap, fail } from "../util.js";

const router = Router();

// Throttle login attempts a little to slow brute force.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

router.post(
  "/login",
  loginLimiter,
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) throw fail(400, "Username and password are required");
    const user = await login(username, password);
    if (!user) throw fail(401, "Invalid username or password.");
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// Restore session from a saved token (used on app refresh).
router.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM app_users WHERE id = $1 AND is_active = true",
      [req.user.sub]
    );
    const user = rows[0];
    if (!user) throw fail(401, "Account no longer active");
    res.json({ user: publicUser(user) });
  })
);

export default router;
