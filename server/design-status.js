export const DESIGN_STATUSES = [
  "draft",
  "Intake",
  "Brief Review",
  "In Design",
  "Proofing",
  "Revisions",
  "Approved",
];

export const CLIENT_VISIBLE_STATUSES = ["Proofing", "Revisions", "Approved"];

export const POOL_STATUSES = ["Intake", "Brief Review"];

export const ACTIVE_STATUSES = DESIGN_STATUSES.filter((s) => s !== "Approved" && s !== "draft");

export const RUSH_PRIORITIES = ["Rush", "Election critical"];

export function isDesigner(user) {
  return !!(user?.isDesigner || user?.is_designer);
}

export function isStaffOrAdmin(user) {
  return user?.role === "staff" || user?.role === "admin";
}
