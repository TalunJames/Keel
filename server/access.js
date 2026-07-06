import { DEFAULT_MODULES } from "./db.js";
import { ALL_MODULE_IDS } from "./access-modules.js";

/** Mirrors src/lib/access.js for server-side checks. */
export function clientModulesForRole(client, role) {
  if (!client || client.id === "all") return null;

  const hasStored = client.staffModules || client.clientModules;
  if (!hasStored && !client.type) return null;

  const fromType = modulesForType(client.type || "");
  const staffMap = client.staffModules || fromType.staffModules;
  const clientMap = client.clientModules || fromType.clientModules;

  if (role === "client") return { ...clientMap };
  return { ...staffMap };
}

// Inline minimal preset lookup — server can't import from src/
const PRESET_MODULES = {
  "Campaign Services": {
    staff: ["home", "calendar", "design", "proposals", "media", "election", "voter", "polling", "stakeholders", "resources", "onboarding"],
    client: ["home", "calendar", "design", "polling", "stakeholders", "resources"],
  },
  "Community Outreach": {
    staff: ["home", "calendar", "design", "proposals", "media", "stakeholders", "resources", "onboarding"],
    client: ["home", "calendar", "design", "stakeholders", "resources"],
  },
  "Crisis Communications": {
    staff: ["home", "calendar", "design", "proposals", "media", "stakeholders", "resources"],
    client: ["home", "calendar", "design", "resources"],
  },
  "Public Affairs": {
    staff: ["home", "calendar", "design", "proposals", "media", "polling", "stakeholders", "resources", "onboarding"],
    client: ["home", "calendar", "design", "polling", "stakeholders", "resources"],
  },
  "Financial Strategy": {
    staff: ["home", "calendar", "proposals", "resources", "onboarding"],
    client: ["home", "calendar", "resources"],
  },
  Custom: {
    staff: ["home", "calendar", "design", "proposals", "resources"],
    client: ["home", "calendar", "resources"],
  },
};

const STAFF_ONLY = new Set(["voter", "onboarding"]);

function modsFromList(ids) {
  return Object.fromEntries(ALL_MODULE_IDS.map((id) => [id, ids.includes(id)]));
}

function modulesForType(typeId) {
  const preset = PRESET_MODULES[typeId] || PRESET_MODULES["Campaign Services"];
  return {
    staffModules: modsFromList(preset.staff),
    clientModules: modsFromList(
      preset.client.filter((id) => !STAFF_ONLY.has(id))
    ),
  };
}

export function computeEffectiveModules({ role, roleModules, client, userOverrides = null }) {
  const ceiling = roleModules || DEFAULT_MODULES[role] || {};
  const workspace = clientModulesForRole(client, role);
  const overrides = userOverrides && client?.id && client.id !== "all" ? userOverrides : null;

  const effective = {};
  for (const id of ALL_MODULE_IDS) {
    if (id === "home") {
      effective[id] = true;
      continue;
    }
    if (STAFF_ONLY.has(id) && role === "client") {
      effective[id] = false;
      continue;
    }

    let on = workspace
      ? !!(ceiling[id] && workspace[id])
      : !!ceiling[id];

    if (overrides && overrides[id] !== undefined) {
      if (!(STAFF_ONLY.has(id) && role === "client")) {
        // An override may only enable a module the role ceiling also allows —
        // it can never grant access above the ceiling. It can still disable.
        on = !!overrides[id] && !!ceiling[id];
      }
    }
    effective[id] = on;
  }
  return effective;
}

export function canAccessModule(moduleId, effectiveModules, role) {
  if (moduleId === "home") return true;
  if (STAFF_ONLY.has(moduleId) && role === "client") return false;
  return !!effectiveModules[moduleId];
}
