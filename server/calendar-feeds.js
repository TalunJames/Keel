import ical from "node-ical";

// External calendar feeds (Google Calendar public/secret iCal addresses, or any
// ICS URL). Feeds are fetched server-side so private secret addresses never
// reach the browser, then parsed and expanded into plain event objects.

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_FEED_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS_PER_FEED = 500;
const cache = new Map(); // url -> { at: epoch ms, parsed }

/**
 * Accepts what a user is likely to paste and returns a canonical ICS URL:
 *  - a full ICS URL (public or secret address), incl. webcal://
 *  - a Google Calendar embed link (…/calendar/embed?src=<id>)
 *  - a bare Google calendar ID (e.g. abc123@group.calendar.google.com)
 */
export function normalizeFeedUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) return { error: "Calendar address is required" };

  if (/^webcal:\/\//i.test(raw)) raw = raw.replace(/^webcal:\/\//i, "https://");

  // Bare Google calendar ID → public ICS address.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (/^[^\s\/]+@[^\s\/]+$/.test(raw)) {
      raw = `https://calendar.google.com/calendar/ical/${encodeURIComponent(raw)}/public/basic.ics`;
    } else {
      raw = "https://" + raw;
    }
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "That doesn't look like a valid calendar address" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Calendar address must be an http(s) or webcal link" };
  }

  // Google embed links carry the calendar ID in ?src=.
  if (/(^|\.)calendar\.google\.com$/i.test(url.hostname) && url.pathname.includes("/embed")) {
    const src = url.searchParams.get("src");
    if (!src) return { error: "This Google embed link has no calendar ID (?src=…)" };
    url = new URL(`https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`);
  }

  // Keep server-side fetches away from internal hosts.
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" || host === "0.0.0.0" || host === "[::1]" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (privateHost && process.env.NODE_ENV === "production") {
    return { error: "Calendar address points at a private network host" };
  }

  return { url: url.toString() };
}

/** Hide the path (which is the secret for private feeds) but keep it recognizable. */
export function maskFeedUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/…/${u.pathname.split("/").pop() || ""}`;
  } catch {
    return "";
  }
}

async function fetchIcs(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Keel-Calendar/1.0", Accept: "text/calendar, text/plain, */*" },
    });
    if (!res.ok) throw new Error(`Feed responded with HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_FEED_BYTES) throw new Error("Feed is too large");
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      throw new Error("Address did not return calendar (ICS) data — check the link");
    }
    return ical.parseICS(text);
  } finally {
    clearTimeout(timer);
  }
}

async function getParsedFeed(url, { fresh = false } = {}) {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.parsed;
  const parsed = await fetchIcs(url);
  cache.set(url, { at: Date.now(), parsed });
  return parsed;
}

export function invalidateFeedCache(url) {
  if (url) cache.delete(url);
  else cache.clear();
}

/** Throws with a user-facing message if the URL can't be fetched/parsed. */
export async function testFeed(url) {
  const parsed = await getParsedFeed(url, { fresh: true });
  let count = 0;
  for (const item of Object.values(parsed)) if (item?.type === "VEVENT") count++;
  return { eventCount: count };
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Calendar day in the Date's local components — matches node-ical VALUE=DATE (local midnight). */
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * All-day ICS dates are floating calendar days, not UTC instants. Emit YYYY-MM-DD so
 * clients west of the server TZ don't shift them to the previous local day.
 */
const serializeInstant = (d, allDay) => (allDay ? dayKey(d) : d.toISOString());

function expandEvents(parsed, feed, rangeStart, rangeEnd) {
  const out = [];
  const push = (start, end, allDay, ev) => {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
    if (start >= rangeEnd) return;
    if ((end || start) <= rangeStart && start < rangeStart) return;
    const startsAt = serializeInstant(start, allDay);
    out.push({
      id: `feed-${feed.id}:${ev.uid || ev.summary || "event"}:${startsAt}`,
      feedId: feed.id,
      title: ev.summary ? String(ev.summary) : "(untitled)",
      startsAt,
      endsAt: end ? serializeInstant(end, allDay) : null,
      location: ev.location ? String(ev.location) : null,
      allDay,
    });
  };

  for (const ev of Object.values(parsed)) {
    if (!ev || ev.type !== "VEVENT" || !ev.start) continue;
    if (ev.status && String(ev.status).toUpperCase() === "CANCELLED") continue;
    const allDay = ev.datetype === "date";
    const durationMs = ev.end ? Math.max(0, ev.end.getTime() - ev.start.getTime()) : 0;

    if (!ev.rrule) {
      push(ev.start, ev.end || null, allDay, ev);
      continue;
    }

    const exTimes = new Set(
      Object.values(ev.exdate || {}).map((d) => new Date(d).getTime())
    );
    const exDays = new Set(Object.values(ev.exdate || {}).map((d) => dayKey(new Date(d))));
    const overrides = Object.values(ev.recurrences || {});
    const overrideDays = new Set(
      overrides.map((o) => dayKey(new Date(o.recurrenceid || o.start)))
    );

    // Look back one duration so events straddling the range start are kept.
    const from = new Date(rangeStart.getTime() - durationMs - 24 * 3600 * 1000);
    let occurrences = [];
    try {
      occurrences = ev.rrule.between(from, rangeEnd, true);
    } catch {
      occurrences = [];
    }
    for (const d of occurrences.slice(0, MAX_EVENTS_PER_FEED)) {
      if (exTimes.has(d.getTime()) || exDays.has(dayKey(d))) continue;
      if (overrideDays.has(dayKey(d))) continue; // rendered from the override below
      push(d, durationMs ? new Date(d.getTime() + durationMs) : null, allDay, ev);
    }
    for (const o of overrides) {
      if (!o?.start) continue;
      if (o.status && String(o.status).toUpperCase() === "CANCELLED") continue;
      push(o.start, o.end || null, o.datetype === "date", o);
    }
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out.slice(0, MAX_EVENTS_PER_FEED);
}

/** Returns { events, error } — error is a user-facing string when the fetch failed. */
export async function fetchFeedEvents(feed, rangeStart, rangeEnd) {
  try {
    const parsed = await getParsedFeed(feed.url);
    return { events: expandEvents(parsed, feed, rangeStart, rangeEnd), error: null };
  } catch (err) {
    const message = err?.name === "AbortError" ? "Feed timed out" : err?.message || "Could not load feed";
    return { events: [], error: message };
  }
}
