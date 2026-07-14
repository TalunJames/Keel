import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import { initSetupToken } from "./bootstrap.js";
import {
  initElectionCollector,
  shutdownElectionCollector,
} from "./election-collector-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

const db = openDb();
initSetupToken(db);
const app = express();

// Security headers. The CSP is tailored to the SPA + MapLibre GL (which needs
// blob: web workers and data:/https: images and connects to tile/geocoder
// hosts). COEP is disabled because it breaks cross-origin map tiles/workers.
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      workerSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
}));

// Trust X-Forwarded-* from Cloudflare tunnel / reverse proxy so secure cookies work.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

// CORS_ORIGIN accepts a comma-separated allowlist so multiple public hostnames
// (e.g. portal.fogsignalstrategies.com + keel.fogsignalstrategies.com) work
// against the same backend. Empty/unset means "reflect any origin" (dev only).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (isProd && !allowedOrigins.length) {
  // Reflecting arbitrary origins with credentials on a PII app is unsafe. In
  // production we require an explicit allowlist; without one, only same-origin
  // requests (which carry no Origin header) are permitted.
  console.warn("[cors] CORS_ORIGIN is unset in production — only same-origin requests will be allowed.");
}
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                 // same-origin / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Dev convenience: with no allowlist configured outside production, reflect
    // any origin so LAN/IP access works. In production this branch never runs.
    if (!allowedOrigins.length && !isProd) return cb(null, true);
    cb(null, false); // not allowlisted → no CORS headers (browser blocks it)
  },
  credentials: true,
}));

// Capture the exact request bytes so webhook HMAC verification (see
// cleatus-routes.js) can hash what was actually sent, not a re-serialization.
const captureRaw = (req, _res, buf) => { req.rawBody = buf; };

// Base64 design uploads (15 MB binary ≈ 20 MB base64) need a large limit — but
// ONLY on that endpoint. Everything else (incl. unauthenticated login/setup) is
// capped small so a 25 MB body can't be used as a cheap memory/CPU DoS.
app.use("/api/design/uploads", express.json({ limit: "25mb", verify: captureRaw }));
// Proposal documents embed cover art / signatures as data URIs and routinely
// exceed 1 MB — without this carve-out the global parser 413s their saves and
// live sync silently stalls (the client keeps retrying forever).
app.use("/proposals/app/api", express.json({ limit: "25mb", verify: captureRaw }));
app.use(express.json({ limit: "1mb", verify: captureRaw }));
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
  app.get(/^(?!\/api)(?!\/periscope)(?!\/proposals).*/, (_req, res) => {
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
