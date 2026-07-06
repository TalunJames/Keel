// Periscope mailer proof viewer — mounted under /periscope inside Keel.
// Vendored from https://github.com/TalunJames/periscope

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import { isDesigner, isStaffOrAdmin } from "./design-status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.join(__dirname, "..", "vendor", "periscope");
const UPLOAD_DIR = process.env.PERISCOPE_UPLOAD_DIR
  || path.join(__dirname, "..", "data", "periscope", "uploads");
const SHARES_DIR = process.env.PERISCOPE_SHARES_DIR
  || path.join(__dirname, "..", "data", "periscope", "shares");
const BASE = "/periscope";
const MAX_UPLOAD_MB = parseInt(process.env.PERISCOPE_MAX_UPLOAD_MB || "75", 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_SHARE_BYTES = 256 * 1024;

const SAFE_FILENAME = /^[A-Za-z0-9._-]+\.pdf$/;
const SAFE_SHARE_ID = /^[a-z0-9]{6,32}$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SHARES_DIR, { recursive: true });

const seedDir = path.join(VENDOR_DIR, "uploads");
if (fs.existsSync(seedDir)) {
  for (const f of fs.readdirSync(seedDir)) {
    const dst = path.join(UPLOAD_DIR, f);
    if (!fs.existsSync(dst)) fs.copyFileSync(path.join(seedDir, f), dst);
  }
}

function sanitizeBaseName(name) {
  const stripped = name.replace(/\.pdf$/i, "");
  const safe = stripped.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
  return safe || "mailer";
}

function prettyName(filename) {
  return filename
    .replace(/-[a-f0-9]{12}\.pdf$/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ");
}

function makeShareId() {
  return crypto.randomBytes(8).toString("hex").slice(0, 10);
}

function rewritePdfUrls(config) {
  if (!config || typeof config !== "object") return config;
  const out = { ...config };
  if (typeof out.pdfUrl === "string" && out.pdfUrl.startsWith("/uploads/")) {
    out.pdfUrl = `${BASE}${out.pdfUrl}`;
  }
  return out;
}

function prefixShareUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith(BASE)) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const base = sanitizeBaseName(file.originalname);
    const id = crypto.randomBytes(6).toString("hex");
    cb(null, `${base}-${id}.pdf`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    if (!ok) return cb(new Error("Only PDF files are accepted"));
    cb(null, true);
  },
});

export function registerPeriscopeRoutes(app, auth) {
  const requireDesignerCapable = (req, res, next) => {
    if (!isStaffOrAdmin(req.user) && !isDesigner(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  const api = express.Router();
  api.use(express.json({ limit: MAX_SHARE_BYTES }));

  api.get("/auth-status", (_req, res) => {
    res.json({ authRequired: true, base: BASE });
  });

  api.get("/uploads", auth, requireDesignerCapable, async (_req, res) => {
    try {
      const files = (await fs.promises.readdir(UPLOAD_DIR)).filter((f) => /\.pdf$/i.test(f));
      const items = await Promise.all(files.map(async (f) => {
        const stat = await fs.promises.stat(path.join(UPLOAD_DIR, f));
        return {
          url: `${BASE}/uploads/${encodeURIComponent(f)}`,
          filename: f,
          name: prettyName(f),
          size: stat.size,
          modified: stat.mtimeMs,
        };
      }));
      items.sort((a, b) => b.modified - a.modified);
      res.json({ uploads: items });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  api.post("/uploads", auth, requireDesignerCapable, (req, res, next) => {
    upload.single("pdf")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      res.json({
        url: `${BASE}/uploads/${encodeURIComponent(req.file.filename)}`,
        filename: req.file.filename,
        name: prettyName(req.file.filename),
        size: req.file.size,
      });
    });
  });

  api.delete("/uploads/:filename", auth, requireDesignerCapable, async (req, res) => {
    const filename = req.params.filename;
    if (!SAFE_FILENAME.test(filename)) return res.status(400).json({ error: "Invalid filename" });
    try {
      await fs.promises.unlink(path.join(UPLOAD_DIR, filename));
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "Not found" });
      res.status(500).json({ error: e.message });
    }
  });

  api.post("/shares", auth, requireDesignerCapable, async (req, res) => {
    try {
      const config = req.body?.config;
      if (!config || typeof config !== "object") {
        return res.status(400).json({ error: "Missing config" });
      }
      const slim = rewritePdfUrls({ ...config });
      delete slim.pdfDataUrl;
      const payload = JSON.stringify({ created: Date.now(), config: slim });
      if (Buffer.byteLength(payload, "utf8") > MAX_SHARE_BYTES) {
        return res.status(413).json({ error: "Share payload too large" });
      }
      let id;
      for (let attempt = 0; attempt < 5; attempt++) {
        id = makeShareId();
        try {
          await fs.promises.writeFile(path.join(SHARES_DIR, `${id}.json`), payload, { flag: "wx" });
          break;
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
          id = null;
        }
      }
      if (!id) return res.status(500).json({ error: "Could not allocate share id" });
      res.json({ id, url: `${BASE}/s/${id}` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  api.get("/shares/:id", async (req, res) => {
    const id = req.params.id;
    if (!SAFE_SHARE_ID.test(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const raw = await fs.promises.readFile(path.join(SHARES_DIR, `${id}.json`), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.config) parsed.config = rewritePdfUrls(parsed.config);
      res.json(parsed);
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "Not found" });
      res.status(500).json({ error: e.message });
    }
  });

  api.delete("/shares/:id", auth, requireDesignerCapable, async (req, res) => {
    const id = req.params.id;
    if (!SAFE_SHARE_ID.test(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      await fs.promises.unlink(path.join(SHARES_DIR, `${id}.json`));
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "Not found" });
      res.status(500).json({ error: e.message });
    }
  });

  app.use(`${BASE}/api`, api);

  app.get(`${BASE}/uploads/:filename`, auth, (req, res) => {
    const filename = req.params.filename;
    if (!SAFE_FILENAME.test(filename)) return res.sendStatus(400);
    res.sendFile(filename, {
      root: UPLOAD_DIR,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400",
      },
    }, (err) => {
      if (err && !res.headersSent) {
        if (err.code === "ENOENT") res.sendStatus(404);
        else res.sendStatus(500);
      }
    });
  });

  app.get(`${BASE}/healthz`, (_req, res) => res.type("text/plain").send("ok\n"));

  const staticRouter = express.static(VENDOR_DIR, { index: false });
  app.use(BASE, staticRouter);

  const indexPath = path.join(VENDOR_DIR, "index-keel.html");
  const sendShell = (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) res.status(500).send("Periscope shell missing");
    });
  };
  app.get(`${BASE}/app`, sendShell);
  app.get(`${BASE}/s/:id`, sendShell);
  app.get(`${BASE}/`, sendShell);
}

/** Create or update a Periscope share from a mailer proof config. */
export async function savePeriscopeShare(config, existingId = null) {
  const slim = rewritePdfUrls({ ...config });
  delete slim.pdfDataUrl;
  const payload = JSON.stringify({ created: Date.now(), config: slim });
  if (Buffer.byteLength(payload, "utf8") > MAX_SHARE_BYTES) {
    throw new Error("Share payload too large");
  }
  if (existingId && SAFE_SHARE_ID.test(existingId)) {
    await fs.promises.writeFile(path.join(SHARES_DIR, `${existingId}.json`), payload);
    return { id: existingId, url: `${BASE}/s/${existingId}` };
  }
  let id;
  for (let attempt = 0; attempt < 5; attempt++) {
    id = makeShareId();
    try {
      await fs.promises.writeFile(path.join(SHARES_DIR, `${id}.json`), payload, { flag: "wx" });
      return { id, url: `${BASE}/s/${id}` };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw new Error("Could not allocate share id");
}

export function readPeriscopeShare(id) {
  if (!SAFE_SHARE_ID.test(id)) return null;
  try {
    const raw = fs.readFileSync(path.join(SHARES_DIR, `${id}.json`), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.config) parsed.config = rewritePdfUrls(parsed.config);
    return parsed;
  } catch {
    return null;
  }
}

export { BASE as PERISCOPE_BASE };
