import fs from "fs";
import path from "path";

const POLL_UPSERT = `
  INSERT INTO polls (id, title, client_id, n, moe, date_range, unlocked, payload_json)
  VALUES (@id, @title, @client_id, @n, @moe, @date_range, @unlocked, @payload_json)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    client_id = excluded.client_id,
    n = excluded.n,
    moe = excluded.moe,
    date_range = excluded.date_range,
    unlocked = excluded.unlocked,
    payload_json = excluded.payload_json
`;

const RESOURCE_UPSERT = `
  INSERT INTO resources (title, category, client_id, account, author, kind, tags_json, url)
  SELECT @title, @category, @client_id, @account, @author, @kind, @tags_json, @url
  WHERE NOT EXISTS (
    SELECT 1 FROM resources WHERE client_id = @client_id AND url = @url
  )
`;

export function pollingManifestPublicPath(clientId, publicRoot) {
  return path.join(publicRoot, "election-data", "clients", clientId, "polling-manifest.json");
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadPortalDir(portalDir) {
  const manifestPath = path.join(portalDir, "polling-manifest.json");
  const pollsDir = path.join(portalDir, "polls");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing polling-manifest.json in ${portalDir}`);
  }
  if (!fs.existsSync(pollsDir)) {
    throw new Error(`Missing polls/ directory in ${portalDir}`);
  }

  const manifest = readJsonFile(manifestPath);
  const polls = fs.readdirSync(pollsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJsonFile(path.join(pollsDir, f)));

  if (!polls.length) throw new Error(`No poll JSON files found in ${pollsDir}`);

  const clientId = manifest.clientId || polls.find((p) => p.client_id)?.client_id;
  if (!clientId) throw new Error("Could not determine client id from portal files");

  return { clientId, manifest, polls };
}

export function upsertPoll(db, poll) {
  const payload = poll.payload
    ? { ...poll.payload, ...(poll.tone ? { tone: poll.tone } : {}) }
    : poll.tone
      ? { tone: poll.tone }
      : null;
  db.prepare(POLL_UPSERT).run({
    id: poll.id,
    title: poll.title,
    client_id: poll.client_id,
    n: poll.n ?? null,
    moe: poll.moe ?? null,
    date_range: poll.date_range ?? poll.date ?? null,
    unlocked: poll.unlocked ? 1 : 0,
    payload_json: payload ? JSON.stringify(payload) : null,
  });
}

function assetResources(poll, clientId) {
  const assets = poll.payload?.assets;
  if (!assets) return [];

  const out = [];
  const add = (url, title, kind = "pdf") => {
    if (!url) return;
    out.push({
      title,
      category: "Polling",
      client_id: clientId,
      account: poll.title,
      author: "Fog Signal Strategies",
      kind,
      tags_json: JSON.stringify([poll.payload?.releaseTier || "polling", poll.id]),
      url,
    });
  };

  add(assets.pdf, `${poll.title} — Topline`, "pdf");
  add(assets.crosstabPdf, `${poll.title} — Crosstabs`, "pdf");
  add(assets.reportPdf, `${poll.title} — Full report`, "pdf");
  add(assets.presentation, `${poll.title} — Presentation`, "pptx");
  return out;
}

export function upsertPollResources(db, polls, clientId, extraResources = []) {
  const insert = db.prepare(RESOURCE_UPSERT);
  const seen = new Set();

  for (const poll of polls) {
    for (const resource of assetResources(poll, clientId)) {
      const key = `${resource.client_id}:${resource.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      insert.run(resource);
    }
  }

  for (const resource of extraResources) {
    const row = {
      title: resource.title,
      category: resource.category || "Polling",
      client_id: clientId,
      account: resource.account || "",
      author: resource.author || "Fog Signal Strategies",
      kind: resource.kind || "pdf",
      tags_json: JSON.stringify(resource.tags || ["polling"]),
      url: resource.url,
    };
    const key = `${row.client_id}:${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    insert.run(row);
  }
}

export function writePollingManifest(clientId, manifest, publicRoot) {
  const outPath = pollingManifestPublicPath(clientId, publicRoot);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const body = {
    clientId,
    waves: Array.isArray(manifest.waves) ? manifest.waves : [],
    threshold: manifest.threshold ?? null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`);
  return outPath;
}

export function ensureClient(db, clientId, profile = {}) {
  const existing = db.prepare("SELECT id FROM clients WHERE id = ?").get(clientId);
  if (existing) return false;

  const {
    name = clientId,
    tag = clientId.toUpperCase().replace(/-/g, " ").slice(0, 8),
    initials = tag.slice(0, 2),
    account = name,
    type = "School bond · Feasibility",
    color = "var(--fs-navy)",
    audience = "",
    payload = {},
  } = profile;

  db.prepare(
    `INSERT INTO clients (id, name, tag, initials, account, type, color, audience, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    clientId,
    name,
    tag,
    initials,
    account,
    type,
    color,
    audience,
    Object.keys(payload).length ? JSON.stringify(payload) : null,
  );
  return true;
}

export function ingestPollingPortal(db, { portalDir, publicRoot, extraResources = [], who = "poll-ingest" }) {
  const { clientId, manifest, polls } = loadPortalDir(portalDir);

  if (manifest.client) {
    ensureClient(db, clientId, manifest.client);
  }

  for (const poll of polls) {
    if (poll.client_id && poll.client_id !== clientId) {
      throw new Error(`Poll ${poll.id} client_id mismatch (${poll.client_id} vs ${clientId})`);
    }
    upsertPoll(db, { ...poll, client_id: clientId });
  }

  upsertPollResources(db, polls, clientId, extraResources);
  const manifestPath = writePollingManifest(clientId, manifest, publicRoot);

  db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
    who,
    `Ingested ${polls.length} poll(s) and manifest for ${clientId}`,
    "Data",
  );

  return { clientId, pollCount: polls.length, manifestPath, pollIds: polls.map((p) => p.id) };
}
