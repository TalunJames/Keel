export const DESIGN_STATUSES = [
  "draft",
  "Submitted",
  "Assigned",
  "In Design",
  "Final Proof",
  "Revisions",
  "Closed",
];

export const STATUS_TONES = {
  draft: "outline",
  Submitted: "outline",
  Assigned: "navy",
  "In Design": "warning",
  "Final Proof": "gold",
  Revisions: "danger",
  Closed: "success",
};

export const CLIENT_VISIBLE_STATUSES = ["Final Proof", "Revisions", "Closed"];

export const POOL_STATUSES = ["Submitted"];

export const ACTIVE_STATUSES = DESIGN_STATUSES.filter((s) => s !== "Closed" && s !== "draft");

export const DESIGNER_TRANSITIONS = {
  Assigned: ["In Design"],
  "In Design": ["Final Proof"],
  "Final Proof": ["Revisions"],
  Revisions: ["In Design"],
};

export const PRIORITIES = ["Urgent", "Important", "Normal", "Backburner"];

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
  const rank = { Urgent: 0, Important: 1, Normal: 2, Backburner: 3 };
  const ra = rank[a] ?? 2;
  const rb = rank[b] ?? 2;
  if (ra !== rb) return ra - rb;
  return 0;
}
