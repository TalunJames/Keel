// JSON schemas for structured Claude output. Structured outputs require
// `additionalProperties: false` on every object and no unsupported constraints
// (no minLength/maximum/etc.). Dynamic-key objects (like editor content{})
// are avoided — the model returns arrays the server maps into editor-v1.

// The block types Claude may compose the proposal from — the real editor
// library. Structural types (cover, toc, team, experience, cost, signature)
// render from their own defaults; the rest carry drafted HTML.
export const DRAFT_BLOCK_TYPES = [
  "cover", "coverLetter", "toc", "divider",
  "about", "approach", "why",
  "team", "experience",
  "understanding", "workplan", "schedule",
  "cost",
  "terms", "exceptions", "signature", "conclusion",
  "heading", "text", "quote",
];

// Types that carry drafted body HTML (everything else renders from defaults).
export const HTML_BLOCK_TYPES = [
  "coverLetter", "about", "approach", "why", "understanding", "workplan",
  "schedule", "terms", "exceptions", "conclusion", "text", "quote",
];

// Feature 1 — RFP → drafted proposal. Claude returns an ORDERED block plan
// composed from the real block types, plus metadata and the RFP checklist.
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["meta", "blocks", "rfpItems"],
  properties: {
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["title", "agency", "serviceTitle", "rfpNumber", "deadline"],
      properties: {
        title: { type: "string", description: "Proposal title, e.g. 'Proposal for <service> — <agency>'" },
        agency: { type: "string", description: "Issuing agency / client name from the RFP" },
        serviceTitle: { type: "string", description: "The service being proposed, e.g. 'Public Education & Community Outreach Services'" },
        rfpNumber: { type: "string", description: "RFP/solicitation number if present, else empty string" },
        deadline: { type: "string", description: "Submission deadline as YYYY-MM-DD if present, else empty string" },
      },
    },
    blocks: {
      type: "array",
      description:
        "The proposal as an ORDERED list of blocks, composed from the real block library to match the RFP's required response structure. " +
        "Lead with cover, coverLetter, toc. Use `divider` blocks to open each major section. Include `team`, `experience`, and `cost` where the RFP calls for them. " +
        "Give rich multi-paragraph `html` for narrative/text/quote blocks. Leave `html` empty for structural blocks (cover, coverLetter, toc, team, experience, cost, signature) — the app fills those from firm defaults. For `divider` and `heading`, put the title in `label`.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: { type: "string", enum: DRAFT_BLOCK_TYPES },
          label: { type: "string", description: "Divider/section title, or heading text. Empty for other blocks." },
          html: { type: "string", description: "Body as clean semantic HTML (<p>, <ul>/<li>, <h3>, <b>, <i>). No inline styles or <script>. Empty for structural blocks." },
        },
      },
    },
    rfpItems: {
      type: "array",
      description: "Submission-requirement checklist extracted from the RFP.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "section"],
        properties: {
          label: { type: "string", description: "The requirement, e.g. 'Certificate of insurance'" },
          section: { type: "string", description: "RFP section number if given, else empty string" },
        },
      },
    },
  },
};

// Feature 3 — tailor a single block. Returns the rewritten body HTML.
export const BLOCK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["html"],
  properties: {
    html: {
      type: "string",
      description: "The rewritten block body as clean semantic HTML, preserving the block's role in the proposal.",
    },
  },
};

// Feature 4 — cost help. Suggested prices keyed by the existing category name.
export const COST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "lines"],
  properties: {
    summary: { type: "string", description: "1-3 sentence rationale for the overall pricing." },
    lines: {
      type: "array",
      description: "One entry per existing service category you have a suggested price for. Match `name` to the category exactly.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "suggested", "rationale"],
        properties: {
          name: { type: "string", description: "Exact existing category name" },
          suggested: { type: "number", description: "Suggested flat/monthly fee in whole dollars" },
          rationale: { type: "string" },
        },
      },
    },
  },
};

// Feature 5 — proofread. Per-block find/replace edits.
export const PROOFREAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["edits"],
  properties: {
    edits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blockKey", "find", "replace", "reason", "severity"],
        properties: {
          blockKey: { type: "string", description: "The content key the edit applies to (e.g. 'b_1a2b' or 'b_1a2b.h'), exactly as given in the CURRENT PROPOSAL." },
          find: { type: "string", description: "The exact existing substring to replace (plain text, must occur verbatim in that block)." },
          replace: { type: "string", description: "The corrected text." },
          reason: { type: "string", description: "Short explanation shown to the reviewer." },
          severity: { type: "string", enum: ["typo", "grammar", "clarity", "consistency", "tone"] },
        },
      },
    },
  },
};

// Feature 6 — proposal library distillation. Claude reads a FINISHED proposal
// and extracts the transferable knowledge: structure, voice, persuasion moves,
// reusable language, pricing shape. Stored per-document; synthesized into the
// firm playbook that future drafts learn from.
export const LIBRARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "agency", "clientType", "summary", "sections", "styleNotes", "winningMoves", "reusableLanguage", "pricingNotes"],
  properties: {
    title: { type: "string", description: "The proposal's title or subject." },
    agency: { type: "string", description: "The client/agency the proposal was written for (empty string if unclear)." },
    clientType: { type: "string", description: "Best-guess client category, e.g. school district, city, county, special district, design, state (empty if unclear)." },
    summary: { type: "string", description: "3-5 sentence summary of what was proposed and the overall pitch strategy." },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "purpose"],
        properties: {
          name: { type: "string" },
          purpose: { type: "string", description: "What this section accomplishes and how it's constructed." },
        },
      },
    },
    styleNotes: {
      type: "array",
      items: { type: "string" },
      description: "Concrete observations about voice, tone, formatting, and sentence style.",
    },
    winningMoves: {
      type: "array",
      items: { type: "string" },
      description: "Specific persuasive techniques used — framing, proof points, differentiators, how objections are pre-empted.",
    },
    reusableLanguage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "snippet"],
        properties: {
          label: { type: "string", description: "What the snippet is for (e.g. 'firm introduction', 'community-engagement value prop')." },
          snippet: { type: "string", description: "A short verbatim passage (1-3 sentences) worth reusing or adapting." },
        },
      },
    },
    pricingNotes: { type: "string", description: "How cost was structured and framed (categories, flat vs monthly, justification language). Empty if no pricing present." },
  },
};

// Feature 7 — the aggregate playbook synthesized from all library insights.
export const PLAYBOOK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["playbook"],
  properties: {
    playbook: {
      type: "string",
      description: "The firm proposal playbook in markdown, max ~1200 words.",
    },
  },
};
