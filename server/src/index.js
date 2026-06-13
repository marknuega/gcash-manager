import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { requireAuth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import stateRoutes from "./routes/state.js";
import transactionsRoutes from "./routes/transactions.js";
import floatsRoutes from "./routes/floats.js";
import customersRoutes from "./routes/customers.js";
import outletsRoutes from "./routes/outlets.js";
import accountsRoutes from "./routes/accounts.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  helmet({
    contentSecurityPolicy: false, // SPA uses inline styles
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// public
app.use("/api/auth", authRoutes);

// everything else requires a valid token
app.use("/api/state", requireAuth, stateRoutes);
app.use("/api/transactions", requireAuth, transactionsRoutes);
app.use("/api/floats", requireAuth, floatsRoutes);
app.use("/api/customers", requireAuth, customersRoutes);
app.use("/api/outlets", requireAuth, outletsRoutes);
app.use("/api/accounts", requireAuth, accountsRoutes);

// ---- serve the built frontend (production) ----
const distDir = path.join(__dirname, "..", "..", "dist");
app.use(express.static(distDir));
// SPA fallback: any non-API GET returns index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).send("Frontend not built yet. Run `npm run build` in the project root.");
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GCash Manager server listening on http://0.0.0.0:${PORT}`);
});
