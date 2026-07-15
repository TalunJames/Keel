/* ============ Fog Signal Proposals — status / archive tags ============
   Browser-side mirror of server/proposal-status.js. A proposal's lifecycle
   lives in one field (triageState); these tags are the friendly surface over
   it, shared with CLEATUS. Keep this in sync with the server module.
   Loaded before state.js / main.js; safe standalone (no Keel or server deps). */
'use strict';

const ARCHIVED_TRIAGE = 'archived';

/* User-facing tags, in pipeline order. `triage` is the state a tag writes;
   `aliases` are the states that read back as this tag (legacy working states
   all collapse into Draft). */
const STATUS_TAGS = [
  { key: 'draft',     label: 'Draft',     triage: 'building',  aliases: ['inbox', 'building', 'internal_review'], tone: 'draft',     terminal: false, desc: 'In progress — drafting, pricing, or review' },
  { key: 'submitted', label: 'Submitted', triage: 'sent',      aliases: ['sent'],                                 tone: 'submitted', terminal: true,  desc: 'Delivered to the agency — awaiting a decision' },
  { key: 'won',       label: 'Won',       triage: 'signed',    aliases: ['signed'],                               tone: 'won',       terminal: true,  desc: 'Awarded — the engagement was won' },
  { key: 'lost',      label: 'Lost',      triage: 'declined',  aliases: ['declined'],                             tone: 'lost',      terminal: true,  desc: 'Not awarded' },
  { key: 'archived',  label: 'Archived',  triage: ARCHIVED_TRIAGE, aliases: [ARCHIVED_TRIAGE],                    tone: 'archived',  terminal: true,  desc: 'Set aside — hidden from the active workspace' },
];

const DRAFT_TAG = STATUS_TAGS[0];

/* The tag object for a raw triage_state (defaults to Draft). */
function tagForTriage(triage) {
  const t = String(triage || '').toLowerCase();
  return STATUS_TAGS.find((s) => s.aliases.includes(t)) || DRAFT_TAG;
}

/* The canonical triage_state a tag key writes. */
function triageForTag(tagKey) {
  const s = STATUS_TAGS.find((x) => x.key === tagKey);
  return s ? s.triage : null;
}

const STATUS_BY_KEY = STATUS_TAGS.reduce((m, s) => { m[s.key] = s; return m; }, {});

function isArchivedTriage(triage) {
  return String(triage || '').toLowerCase() === ARCHIVED_TRIAGE;
}

/* Filters shown as chips on the home grid. `active` is the default: everything
   that isn't archived. The rest select a single tag. */
const STATUS_FILTERS = [
  { key: 'active',    label: 'Active',    match: (t) => t.key !== 'archived' },
  { key: 'draft',     label: 'Draft',     match: (t) => t.key === 'draft' },
  { key: 'submitted', label: 'Submitted', match: (t) => t.key === 'submitted' },
  { key: 'won',       label: 'Won',       match: (t) => t.key === 'won' },
  { key: 'lost',      label: 'Lost',      match: (t) => t.key === 'lost' },
  { key: 'archived',  label: 'Archived',  match: (t) => t.key === 'archived' },
  { key: 'all',       label: 'All',       match: () => true },
];
