import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db.js";
import { registerRoutes } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;

const db = openDb();
const app = express();

// CORS_ORIGIN accepts a comma-separated allowlist so multiple public hostnames
// (e.g. portal.fogsignalstrategies.com + keel.fogsignalstrategies.com) work
// against the same backend. Empty/unset means "reflect any origin" (dev only).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                 // same-origin / curl
    if (!allowedOrigins.length) return cb(null, true);  // dev fallback
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not in allowlist`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

registerRoutes(app, db);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "keel-api" });
});

app.get("/api/version", (_req, res) => {
  res.json({
    sha: process.env.KEEL_GIT_SHA || "dev",
    shaShort: process.env.KEEL_GIT_SHA_SHORT || "dev",
    builtAt: process.env.KEEL_BUILD_TIME || "unknown",
    ref: process.env.KEEL_GIT_REF || "local",
  });
});

if (process.env.SERVE_STATIC === "true" || process.env.NODE_ENV === "production") {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Keel API listening on http://localhost:${PORT}`);
});
