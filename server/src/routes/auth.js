import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, signToken, publicUser } from "../auth.js";
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

export default router;
