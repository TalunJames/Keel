import { requireRole } from "./auth.js";
import {
  normalizeFeedUrl,
  maskFeedUrl,
  testFeed,
  fetchFeedEvents,
  invalidateFeedCache,
} from "./calendar-feeds.js";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const VISIBILITIES = new Set(["public", "private"]);

const mapFeed = (r) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  visibility: r.visibility,
  // The path of a private (secret) address is the credential — never send it back.
  urlPreview: maskFeedUrl(r.url),
});

export function registerCalendarFeedRoutes(app, db, auth) {
  const staffOnly = requireRole("staff", "admin");

  const visibleFeeds = (user) => {
    const rows = db.prepare("SELECT * FROM calendar_feeds ORDER BY created_at ASC").all();
    return user.role === "client" ? rows.filter((r) => r.visibility === "public") : rows;
  };

  const logAction = (who, what) => {
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(who, what, "Data");
  };

  app.get("/api/calendar/feeds", auth, (req, res) => {
    res.json({ feeds: visibleFeeds(req.user).map(mapFeed) });
  });

  app.get("/api/calendar/feeds/events", auth, async (req, res) => {
    const start = new Date(req.query.start || Date.now());
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid start date" });
    }
    const days = Math.max(1, Math.min(400, Number(req.query.days) || 60));
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const feeds = visibleFeeds(req.user);
    const results = await Promise.all(feeds.map((f) => fetchFeedEvents(f, start, end)));
    const events = [];
    const errors = [];
    feeds.forEach((f, i) => {
      events.push(...results[i].events);
      if (results[i].error) errors.push({ feedId: f.id, name: f.name, message: results[i].error });
    });
    events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    res.json({ events, errors });
  });

  app.post("/api/calendar/feeds", auth, staffOnly, async (req, res) => {
    const { name, url, color, visibility } = req.body || {};
    const trimmedName = String(name || "").trim();
    if (!trimmedName) return res.status(400).json({ error: "Name is required" });
    const normalized = normalizeFeedUrl(url);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const vis = VISIBILITIES.has(visibility) ? visibility : "public";
    const feedColor = HEX_COLOR.test(color || "") ? color : "#2f6fb2";

    try {
      await testFeed(normalized.url);
    } catch (err) {
      return res.status(400).json({ error: "Could not read that calendar: " + (err?.message || "fetch failed") });
    }

    const info = db.prepare(
      "INSERT INTO calendar_feeds (name, url, color, visibility, created_by) VALUES (?, ?, ?, ?, ?)"
    ).run(trimmedName, normalized.url, feedColor, vis, req.user.email);
    const row = db.prepare("SELECT * FROM calendar_feeds WHERE id = ?").get(info.lastInsertRowid);
    logAction(req.user.email, `Attached calendar feed "${trimmedName}"`);
    res.status(201).json({ feed: mapFeed(row) });
  });

  app.patch("/api/calendar/feeds/:id", auth, staffOnly, async (req, res) => {
    const existing = db.prepare("SELECT * FROM calendar_feeds WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { name, url, color, visibility } = req.body || {};
    const sets = [];
    const args = [];
    if (name !== undefined) {
      const trimmed = String(name || "").trim();
      if (!trimmed) return res.status(400).json({ error: "Name is required" });
      sets.push("name = ?"); args.push(trimmed);
    }
    if (color !== undefined) {
      if (!HEX_COLOR.test(color || "")) return res.status(400).json({ error: "Color must be a hex value" });
      sets.push("color = ?"); args.push(color);
    }
    if (visibility !== undefined) {
      if (!VISIBILITIES.has(visibility)) return res.status(400).json({ error: "Invalid visibility" });
      sets.push("visibility = ?"); args.push(visibility);
    }
    if (url !== undefined && String(url || "").trim() !== "") {
      const normalized = normalizeFeedUrl(url);
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      try {
        await testFeed(normalized.url);
      } catch (err) {
        return res.status(400).json({ error: "Could not read that calendar: " + (err?.message || "fetch failed") });
      }
      invalidateFeedCache(existing.url);
      sets.push("url = ?"); args.push(normalized.url);
    }
    if (!sets.length) return res.status(400).json({ error: "No fields" });

    args.push(req.params.id);
    db.prepare(`UPDATE calendar_feeds SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    const row = db.prepare("SELECT * FROM calendar_feeds WHERE id = ?").get(req.params.id);
    logAction(req.user.email, `Updated calendar feed "${row.name}"`);
    res.json({ feed: mapFeed(row) });
  });

  app.delete("/api/calendar/feeds/:id", auth, staffOnly, (req, res) => {
    const existing = db.prepare("SELECT * FROM calendar_feeds WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM calendar_feeds WHERE id = ?").run(req.params.id);
    invalidateFeedCache(existing.url);
    logAction(req.user.email, `Detached calendar feed "${existing.name}"`);
    res.json({ ok: true });
  });
}
