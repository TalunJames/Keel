import { ALL_MODULES } from "./modules.js";
import { modulesForType } from "./client-type-presets.js";

export const ROLE_LABELS = {
  staff: "Staff",
  admin: "Admin / Partner",
  client: "Client",
};

/** Workspace module map stored on a client for a given role tier. */
export function clientModulesForRole(client, role) {
  if (!client || client.id === "all") return null;

  const hasStored = client.staffModules || client.clientModules;
  if (!hasStored && !client.type) return null;

  const fromType = modulesForType(client.type || "");
  const staffMap = client.staffModules || fromType.staffModules;
  const clientMap = client.clientModules || fromType.clientModules;

  if (role === "client") return { ...clientMap };
  // Staff and admin/partner share the internal workspace map.
  return { ...staffMap };
}

/**
 * Effective module access for the current user, client, and role defaults.
 * Layers: role ceiling → client workspace → per-user overrides.
 */
export function computeEffectiveModules({ role, roleModules, client, userOverrides = null }) {
  const ceiling = roleModules || {};
  const workspace = clientModulesForRole(client, role);
  const overrides = userOverrides && client?.id && client.id !== "all" ? userOverrides : null;

  const effective = {};
  for (const m of ALL_MODULES) {
    if (m.mandatory) {
      effective[m.id] = true;
      continue;
    }
    if (m.staffOnly && role === "client") {
      effective[m.id] = false;
      continue;
    }

    let on = workspace
      ? !!(ceiling[m.id] && workspace[m.id])
      : !!ceiling[m.id];

    if (overrides && overrides[m.id] !== undefined) {
      if (!(m.staffOnly && role === "client")) {
        on = !!overrides[m.id];
      }
    }
    effective[m.id] = on;
  }
  return effective;
}

export function visibleModuleList(effectiveModules, role) {
  return ALL_MODULES.filter(
    (m) => (effectiveModules[m.id] || m.mandatory) && !(m.staffOnly && role === "client")
  );
}

export function canAccessModule(moduleId, effectiveModules, role) {
  const meta = ALL_MODULES.find((m) => m.id === moduleId);
  if (!meta) return false;
  if (meta.staffOnly && role === "client") return false;
  return !!(effectiveModules[moduleId] || meta.mandatory);
}

/** Sparse overrides — only keys that differ from the computed default. */
export function diffOverrides(base, desired) {
  const sparse = {};
  for (const m of ALL_MODULES) {
    if (m.mandatory) continue;
    const want = !!desired[m.id];
    const was = !!base[m.id];
    if (want !== was) sparse[m.id] = want;
  }
  return sparse;
}
