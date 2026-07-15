// Thin client for the CLEATUS REST API.
//
// Verified against the live service (the OpenAPI spec's `servers` entry is
// misleading): REST endpoints live under https://api.cleat.ai/api/v1/* and
// authenticate with an `X-Api-Key` header. The /v1/zapier/* surface documented
// alongside them requires an OAuth Bearer token (Zapier's browser flow) and is
// NOT usable with an API key.
//
// The key is resolved through integration-settings so it can be entered in
// Admin → Integrations or via the CLEATUS_API_KEY env var.

import { getSecret } from "./integration-settings.js";

const BASE_URL = process.env.CLEATUS_API_BASE || "https://api.cleat.ai/api";

export function cleatusConfigured() {
  return !!getSecret("cleatus_api_key");
}

export class CleatusApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CleatusApiError";
    this.status = status;
  }
}

export async function cleatusFetch(path, { method = "GET", query = null, body = null } = {}) {
  const key = getSecret("cleatus_api_key");
  if (!key) throw new CleatusApiError("CLEATUS API key not configured", 0);

  const url = new URL(BASE_URL.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": key,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = errBody?.message || errBody?.error || "";
    } catch { /* non-JSON error body */ }
    throw new CleatusApiError(
      `CLEATUS API ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`,
      res.status,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

/**
 * One page of the authenticated entity's pipeline.
 * @param {object} opts { status: "active"|"archived"|"won", cursor, limit (max 50) }
 */
export function fetchPipelinePage({ status = null, cursor = null, limit = 50 } = {}) {
  return cleatusFetch("/v1/pipeline/search", { query: { status, cursor, limit } });
}

/** Full pursuit detail. */
export function fetchPursuit(pursuitId) {
  return cleatusFetch(`/v1/pursuits/${encodeURIComponent(pursuitId)}`);
}

/** Authenticated entity profile — used as the connection test. */
export function fetchCleatusProfile() {
  return cleatusFetch("/v1/profile");
}

/**
 * The spec leaves list-response schemas empty, so unwrap defensively:
 * accept a bare array or an envelope under a common key, and surface
 * whatever pagination cursor the payload carries.
 */
export function unwrapListResponse(payload) {
  if (Array.isArray(payload)) return { items: payload, nextCursor: null };
  if (!payload || typeof payload !== "object") return { items: [], nextCursor: null };
  const items =
    ["items", "results", "data", "pursuits", "opportunities"]
      .map((k) => payload[k])
      .find(Array.isArray) || [];
  const nextCursor =
    payload.next_cursor ?? payload.nextCursor ?? payload.cursor ??
    payload.pagination?.next_cursor ?? payload.pagination?.nextCursor ?? null;
  return { items, nextCursor: nextCursor || null };
}
