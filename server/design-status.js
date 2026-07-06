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

// Statuses a designer-assignee may set directly. Excludes 'Approved' (client
// approval only), 'draft'/'Intake' (would hide the request from clients), and
// 'Brief Review' (claim/intake stage). Staff/admins retain full control.
export const DESIGNER_SETTABLE_STATUSES = ["In Design", "Proofing", "Revisions"];

export const ACTIVE_STATUSES = DESIGN_STATUSES.filter((s) => s !== "Approved" && s !== "draft");

export const RUSH_PRIORITIES = ["Rush", "Election critical"];

export function isDesigner(user) {
  return !!(user?.isDesigner || user?.is_designer);
}

export function isStaffOrAdmin(user) {
  return user?.role === "staff" || user?.role === "admin";
}
