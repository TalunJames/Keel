export const DESIGN_STATUSES = [
  "draft",
  "Intake",
  "Brief Review",
  "In Design",
  "Proofing",
  "Revisions",
  "Approved",
];

export const STATUS_TONES = {
  draft: "outline",
  Intake: "outline",
  "Brief Review": "navy",
  "In Design": "warning",
  Proofing: "gold",
  Revisions: "danger",
  Approved: "success",
};

export const CLIENT_VISIBLE_STATUSES = ["Proofing", "Revisions", "Approved"];

export const POOL_STATUSES = ["Intake", "Brief Review"];

export const ACTIVE_STATUSES = DESIGN_STATUSES.filter((s) => s !== "Approved" && s !== "draft");

export const DESIGNER_TRANSITIONS = {
  "Brief Review": ["In Design"],
  "In Design": ["Proofing"],
  Proofing: ["Revisions", "Approved"],
  Revisions: ["In Design", "Proofing"],
};

export const PRIORITIES = ["Standard", "Rush", "Election critical"];

export const ASSET_TYPES = [
  "Print — direct mail",
  "Print — one-pager / leave-behind",
  "Video — broadcast TV",
  "Video — digital / OTT",
  "Social — static",
  "Social — animated",
  "Web — landing page",
  "Other",
];

export function statusTone(status) {
  return STATUS_TONES[status] || "outline";
}

export function prioritySort(a, b) {
  const rank = { "Election critical": 0, Rush: 1, Standard: 2, normal: 2 };
  const ra = rank[a] ?? 3;
  const rb = rank[b] ?? 3;
  if (ra !== rb) return ra - rb;
  return 0;
}
