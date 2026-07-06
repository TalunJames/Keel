export const DESIGN_STATUSES = [
  "draft",
  "Submitted",
  "Assigned",
  "In Design",
  "Final Proof",
  "Revisions",
  "Closed",
];

export const CLIENT_VISIBLE_STATUSES = ["Final Proof", "Revisions", "Closed"];

export const POOL_STATUSES = ["Submitted"];

// Statuses a designer-assignee may set directly.
export const DESIGNER_SETTABLE_STATUSES = ["Assigned", "In Design", "Final Proof", "Revisions"];

export const ACTIVE_STATUSES = DESIGN_STATUSES.filter((s) => s !== "Closed" && s !== "draft");

export const HIGH_PRIORITIES = ["Urgent", "Important"];

export function isDesigner(user) {
  return !!(user?.isDesigner || user?.is_designer);
}

export function isStaffOrAdmin(user) {
  return user?.role === "staff" || user?.role === "admin";
}
