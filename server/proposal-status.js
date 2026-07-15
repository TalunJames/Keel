// ============ Proposal lifecycle / status tags ============
//
// `proposals.triage_state` is the single source of truth for where a proposal
// sits in its lifecycle. CLEATUS drives it inbound (see cleatus-proposals.js,
// which maps pipeline columns onto these states) and staff drive it in the
// proposal builder. The builder surfaces a small set of user-facing TAGS on top
// of the raw states so the two never diverge — a CLEATUS pipeline move and a
// manual "Mark Won" both write the same column.
//
// This module is the shared vocabulary. A browser-side mirror lives at
// vendor/proposals/js/status.js — keep the two in sync.

export const ARCHIVED_TRIAGE = "archived";

// Every triage_state the system understands. `archived` is the newest addition;
// the rest predate the tag layer and map onto the four outcome tags below.
export const TRIAGE_STATES = [
  "inbox",
  "building",
  "internal_review",
  "sent",
  "signed",
  "declined",
  ARCHIVED_TRIAGE,
];

// User-facing tags, in pipeline order. `triage` is the canonical state a tag
// writes; `aliases` are the states that also read back as this tag (so the
// legacy working states all collapse into "Draft").
export const STATUS_TAGS = [
  {
    key: "draft",
    label: "Draft",
    triage: "building",
    aliases: ["inbox", "building", "internal_review"],
    tone: "draft",
    terminal: false,
    desc: "In progress — being drafted, priced, or reviewed",
  },
  {
    key: "submitted",
    label: "Submitted",
    triage: "sent",
    aliases: ["sent"],
    tone: "submitted",
    terminal: true,
    desc: "Delivered to the agency — awaiting a decision",
  },
  {
    key: "won",
    label: "Won",
    triage: "signed",
    aliases: ["signed"],
    tone: "won",
    terminal: true,
    desc: "Awarded — the engagement was won",
  },
  {
    key: "lost",
    label: "Lost",
    triage: "declined",
    aliases: ["declined"],
    tone: "lost",
    terminal: true,
    desc: "Not awarded",
  },
  {
    key: "archived",
    label: "Archived",
    triage: ARCHIVED_TRIAGE,
    aliases: [ARCHIVED_TRIAGE],
    tone: "archived",
    terminal: true,
    desc: "Set aside — hidden from the active workspace",
  },
];

const DRAFT_TAG = STATUS_TAGS[0];

/** The tag that represents a raw triage_state (defaults to Draft). */
export function tagForTriage(triage) {
  const t = String(triage || "").toLowerCase();
  return STATUS_TAGS.find((s) => s.aliases.includes(t)) || DRAFT_TAG;
}

/** The canonical triage_state a tag key writes, or null for an unknown tag. */
export function triageForTag(tagKey) {
  const s = STATUS_TAGS.find((x) => x.key === tagKey);
  return s ? s.triage : null;
}

export function isValidTriage(triage) {
  return TRIAGE_STATES.includes(String(triage || ""));
}

export function isArchivedTriage(triage) {
  return String(triage || "").toLowerCase() === ARCHIVED_TRIAGE;
}

/**
 * Resolve a triage_state from an inbound request that may carry either a raw
 * `triage` state or a friendly `tag`. Returns null if neither is valid.
 */
export function resolveTriage({ triage, tag } = {}) {
  if (tag != null) return triageForTag(String(tag));
  if (triage != null && isValidTriage(triage)) return String(triage);
  return null;
}
