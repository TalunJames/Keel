/** Module presets per service line — applied when a client type is selected in the wizard. */

const STAFF_IDS = [
  "home", "calendar", "design", "proposals", "media",
  "election", "voter", "polling", "stakeholders", "resources", "onboarding",
];

const CLIENT_IDS = ["home", "calendar", "design", "polling", "stakeholders", "resources"];

function mods(ids) {
  return Object.fromEntries(STAFF_IDS.map((id) => [id, ids.includes(id)]));
}

function clientMods(ids) {
  return Object.fromEntries(CLIENT_IDS.map((id) => [id, ids.includes(id)]));
}

export const CLIENT_TYPE_PRESETS = [
  {
    id: "Campaign Services",
    label: "Campaign Services",
    icon: "ballot-box",
    desc: "Full campaign stack — creative, data, election night, and voter tools.",
    staffModules: mods(["home", "calendar", "design", "proposals", "media", "election", "voter", "polling", "stakeholders", "resources", "onboarding"]),
    clientModules: clientMods(["home", "calendar", "design", "polling", "stakeholders", "resources"]),
    highlights: ["Election Night", "Voter Data", "Polling", "Design Requests"],
  },
  {
    id: "Community Outreach",
    label: "Community Outreach",
    icon: "users-group",
    desc: "Grassroots organizing, events, and stakeholder engagement.",
    staffModules: mods(["home", "calendar", "design", "proposals", "media", "stakeholders", "resources", "onboarding"]),
    clientModules: clientMods(["home", "calendar", "design", "stakeholders", "resources"]),
    highlights: ["Stakeholders", "Calendar", "Design Requests"],
  },
  {
    id: "Crisis Communications",
    label: "Crisis Communications",
    icon: "shield-alert",
    desc: "Rapid-response media monitoring, messaging, and approvals.",
    staffModules: mods(["home", "calendar", "design", "proposals", "media", "stakeholders", "resources"]),
    clientModules: clientMods(["home", "calendar", "design", "resources"]),
    highlights: ["Media Monitoring", "Design Requests", "Resources"],
  },
  {
    id: "Public Affairs",
    label: "Public Affairs",
    icon: "landmark",
    desc: "Policy advocacy, polling, and stakeholder tracking.",
    staffModules: mods(["home", "calendar", "design", "proposals", "media", "polling", "stakeholders", "resources", "onboarding"]),
    clientModules: clientMods(["home", "calendar", "design", "polling", "stakeholders", "resources"]),
    highlights: ["Polling", "Stakeholders", "Proposals"],
  },
  {
    id: "Financial Strategy",
    label: "Financial Strategy",
    icon: "chart-bar",
    desc: "Scope docs, memos, and resource delivery — light on creative.",
    staffModules: mods(["home", "calendar", "proposals", "resources", "onboarding"]),
    clientModules: clientMods(["home", "calendar", "resources"]),
    highlights: ["Proposals", "Resources", "Calendar"],
  },
  {
    id: "Custom",
    label: "Custom",
    icon: "sliders",
    desc: "Pick exactly which tabs staff and clients see.",
    staffModules: mods(["home", "calendar", "design", "proposals", "resources"]),
    clientModules: clientMods(["home", "calendar", "resources"]),
    highlights: ["Configure modules manually"],
    isCustom: true,
  },
];

export const STAFF_MODULE_OPTIONS = [
  { id: "home", label: "Home", mandatory: true, icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "design", label: "Design Requests", icon: "pen" },
  { id: "proposals", label: "Proposals", icon: "compass" },
  { id: "media", label: "Media Monitoring", icon: "comment" },
  { id: "election", label: "Election Night", icon: "tv" },
  { id: "voter", label: "Voter Data", icon: "users" },
  { id: "polling", label: "Polling", icon: "trend-up" },
  { id: "stakeholders", label: "Stakeholders", icon: "key" },
  { id: "resources", label: "Resources", icon: "book" },
  { id: "onboarding", label: "Onboarding", icon: "flag" },
];

export const CLIENT_MODULE_OPTIONS = [
  { id: "home", label: "Home dashboard", mandatory: true, icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "design", label: "Design proofs", icon: "pen" },
  { id: "polling", label: "Polling", icon: "trend-up" },
  { id: "stakeholders", label: "Stakeholders", icon: "key" },
  { id: "resources", label: "Memos & resources", icon: "book" },
];

export const STANDARD_TYPE_PRESETS = CLIENT_TYPE_PRESETS.filter((p) => !p.isCustom);
export const CUSTOM_TYPE_PRESET = CLIENT_TYPE_PRESETS.find((p) => p.isCustom) || null;

export function getPreset(typeId) {
  return CLIENT_TYPE_PRESETS.find((p) => p.id === typeId) || CLIENT_TYPE_PRESETS[0];
}

export function modulesForType(typeId) {
  const preset = getPreset(typeId);
  return {
    staffModules: { ...preset.staffModules },
    clientModules: { ...preset.clientModules },
  };
}

export function enabledModuleLabels(modules, options) {
  return options.filter((m) => modules[m.id] || m.mandatory).map((m) => m.label);
}
