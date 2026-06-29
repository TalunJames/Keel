import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import {
  initElectionCollector,
  shutdownElectionCollector,
} from "./election-collector-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;

const db = openDb();
const app = express();

// Trust X-Forwarded-* from Cloudflare tunnel / reverse proxy so secure cookies work.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

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
    // Origin not in allowlist: don't add CORS headers, but don't throw.
    // Same-origin requests (browser knows they're same-origin) succeed because
    // they don't need Access-Control-Allow-Origin. Real cross-origin requests
    // from a disallowed host get blocked by the browser — the desired outcome.
    // Throwing here was the wrong move: it 500s legitimate LAN/IP access where
    // the origin happens to differ from the Cloudflare hostname in the allowlist.
    cb(null, false);
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
  initElectionCollector();
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shutdownElectionCollector();
    process.exit(0);
  });
}
