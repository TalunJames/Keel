/** Proposal templates, block library, and default content — shared seed for API responses. */

export const PROPOSAL_TEMPLATES = [
  {
    id: "boutique",
    name: "Boutique scope memo",
    desc: "Short-form scope of work for a single retainer, single quarter.",
    clientTypes: ["Financial Strategy", "Custom"],
    defaultBlocks: ["cover", "summary", "scope", "deliverables", "timeline", "fees", "signoff"],
  },
  {
    id: "campaign",
    name: "Campaign engagement proposal",
    desc: "Comprehensive proposal for political campaigns — strategy, mail, polling.",
    clientTypes: ["Campaign Services"],
    defaultBlocks: ["cover", "aboutfirm", "situation", "approach", "scope", "team", "caseStudy", "timeline", "fees", "signoff"],
  },
  {
    id: "publicaff",
    name: "Public-affairs RFP response",
    desc: "Formal response to a state-government RFP. Compliance-forward.",
    clientTypes: ["Public Affairs"],
    defaultBlocks: ["cover", "executive", "approach", "methodology", "team", "compliance", "references", "fees", "signoff"],
  },
  {
    id: "coalition",
    name: "Coalition build-out plan",
    desc: "Multi-party coalition with stakeholder map and rollout phases.",
    clientTypes: ["Community Outreach", "Crisis Communications"],
    defaultBlocks: ["cover", "summary", "situation", "stakeholders", "approach", "timeline", "fees", "signoff"],
  },
];

export const PROPOSAL_BLOCK_TYPES = {
  cover: { label: "Cover page", icon: "image", group: "Front matter" },
  summary: { label: "Executive summary", icon: "comment", group: "Front matter" },
  executive: { label: "Executive summary", icon: "comment", group: "Front matter" },
  aboutfirm: { label: "About Fog Signal", icon: "lighthouse", group: "Front matter" },
  situation: { label: "The situation", icon: "alert", group: "Strategy" },
  approach: { label: "Our approach", icon: "compass", group: "Strategy" },
  methodology: { label: "Methodology", icon: "book", group: "Strategy" },
  stakeholders: { label: "Stakeholder map", icon: "stakeholders", group: "Strategy" },
  scope: { label: "Scope of work", icon: "check", group: "Engagement" },
  deliverables: { label: "Deliverables", icon: "folder", group: "Engagement" },
  team: { label: "Team & roles", icon: "users", group: "Engagement" },
  timeline: { label: "Timeline", icon: "calendar", group: "Engagement" },
  fees: { label: "Fees & retainer", icon: "key", group: "Engagement" },
  signoff: { label: "Sign-off", icon: "pen", group: "Engagement" },
  caseStudy: { label: "Case study", icon: "newspaper", group: "Proof" },
  references: { label: "References", icon: "users", group: "Proof" },
  compliance: { label: "Compliance & filings", icon: "shield", group: "Proof" },
};

/** Default editable content per block type (merged into block instances). */
export function defaultBlockContent(type, { clientName = "Client" } = {}) {
  const cname = clientName || "Client";
  switch (type) {
    case "cover":
      return {
        eyebrow: "Engagement Proposal",
        title: cname,
        subtitle: "Prepared by Fog Signal Strategies",
      };
    case "summary":
    case "executive":
      return {
        paragraphs: [
          `We propose a focused engagement to advance ${cname}'s priority objectives over the next two quarters — combining senior counsel, original research, and a tightly-scoped creative program.`,
          "The work is structured to deliver an audible signal in three months and a defensible record before year-end.",
        ],
      };
    case "aboutfirm":
      return {
        body: "A senior-only public-affairs firm. We move policy and protect reputations for general counsels, advocacy organizations, and statewide campaigns.",
      };
    case "situation":
      return {
        title: "The situation",
        body: `${cname} faces a near-term inflection: a primary in 12 weeks, a fragmenting coalition, and a press environment that has cooled. Polling suggests the underlying support is there — but the message needs new edges and the surrogate roster needs lift.`,
      };
    case "approach":
      return {
        title: "Our approach",
        steps: [
          { n: "01", title: "Listen first", body: "60-min stakeholder interviews + 800-n statewide IVR." },
          { n: "02", title: "Sharpen the signal", body: "Single-page messaging architecture + two test creative concepts." },
          { n: "03", title: "Hold the lighthouse", body: "Weekly delivery cadence, race-night protocols, escalation paths." },
        ],
      };
    case "scope":
      return {
        title: "Scope of work",
        rows: [
          { workstream: "Strategic counsel", detail: "Weekly partner-led calls, ad-hoc memos, scenario planning.", cadence: "Ongoing" },
          { workstream: "Original research", detail: "One statewide poll, two focus groups, monthly tracker.", cadence: "Q1–Q2" },
          { workstream: "Creative production", detail: "Two TV concepts to first proof, mail series, digital cutdowns.", cadence: "Q1" },
          { workstream: "Coalition", detail: "Stakeholder map, surrogate strategy, faith-leader engagement.", cadence: "Q1" },
        ],
      };
    case "deliverables":
      return {
        title: "Deliverables",
        items: [
          "Strategy memo (week 2)",
          "Statewide topline poll",
          "Messaging architecture",
          "Two TV concepts to first proof",
          "Direct mail series (4 pieces)",
          "Surrogate roster + briefing kit",
        ],
      };
    case "team":
      return {
        title: "Your team",
        members: [
          { name: "Margaret Voss", role: "Lead strategist" },
          { name: "Jonas Reiter", role: "Engagement principal" },
          { name: "Eli Park", role: "Data & polling" },
          { name: "Drew Cole", role: "Creative director" },
        ],
      };
    case "timeline":
      return {
        title: "Timeline",
        weeks: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
        bars: [
          { label: "Listening + research", start: 0, span: 2 },
          { label: "Messaging architecture", start: 1, span: 2 },
          { label: "Creative production", start: 2, span: 3 },
          { label: "Field-test + revise", start: 4, span: 2 },
        ],
      };
    case "fees":
      return {
        title: "Fees & retainer",
        rows: [
          { label: "Monthly retainer (strategic counsel, ongoing)", amount: "$28,500 / mo" },
          { label: "Statewide poll (one-time)", amount: "$42,000" },
          { label: "Two focus groups (one-time)", amount: "$24,000" },
          { label: "Creative production (capped)", amount: "$65,000" },
        ],
        total: { label: "Six-month total", amount: "$302,000" },
      };
    case "signoff":
      return {
        title: "Sign-off",
        firmSignatory: { name: "Jonas Reiter", title: "Director of Operations" },
        clientSignatory: { name: "[Authorized signatory]", title: "Date" },
      };
    default:
      return { body: `${type} — click to edit.` };
  }
}

export function blocksFromTemplate(templateId, { clientName } = {}) {
  const tpl = PROPOSAL_TEMPLATES.find((t) => t.id === templateId) || PROPOSAL_TEMPLATES[1];
  return tpl.defaultBlocks.map((type, i) => ({
    id: `${type}-${i}-${Date.now()}`,
    type,
    content: defaultBlockContent(type, { clientName }),
  }));
}

export function templatesForClientType(clientType) {
  const matched = PROPOSAL_TEMPLATES.filter(
    (t) => !t.clientTypes?.length || t.clientTypes.includes(clientType)
  );
  return matched.length ? matched : PROPOSAL_TEMPLATES;
}

export function recommendedBlocksForType(clientType) {
  const tpl = templatesForClientType(clientType)[0];
  if (!tpl) return [];
  return tpl.defaultBlocks.map((type) => ({
    type,
    ...PROPOSAL_BLOCK_TYPES[type],
    recommended: true,
  }));
}

/** Normalize Cleatus triage labels to Keel triage_state values. */
export function normalizeCleatusTriage(raw) {
  const s = String(raw || "").toLowerCase().replace(/[\s_-]+/g, "_");
  if (s.includes("building") && s.includes("proposal")) return "building";
  if (s === "inbox" || s === "new") return "inbox";
  if (s.includes("review")) return "internal_review";
  if (s === "sent") return "sent";
  if (s === "signed" || s === "won") return "signed";
  if (s === "declined" || s === "lost") return "declined";
  return "inbox";
}
