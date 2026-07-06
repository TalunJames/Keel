export const TRIAGE_STATES = [
  "inbox",
  "building",
  "internal_review",
  "sent",
  "signed",
  "declined",
  "archived",
];

export const TRIAGE_LABELS = {
  inbox: "Inbox",
  building: "Building",
  internal_review: "Internal review",
  sent: "Sent",
  signed: "Signed",
  declined: "Declined",
  archived: "Archived",
};

export const TRIAGE_TONES = {
  inbox: "outline",
  building: "navy",
  internal_review: "warning",
  sent: "gold",
  signed: "success",
  declined: "danger",
  archived: "outline",
};

export const TRIAGE_COLUMNS = [
  { key: "inbox", label: "Inbox" },
  { key: "building", label: "Building proposal" },
  { key: "internal_review", label: "Internal review" },
  { key: "sent", label: "Sent" },
  { key: "signed", label: "Signed" },
  { key: "declined", label: "Declined" },
];

export function triageLabel(state) {
  return TRIAGE_LABELS[state] || state;
}

export function triageTone(state) {
  return TRIAGE_TONES[state] || "outline";
}
