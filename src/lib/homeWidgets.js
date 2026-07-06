export const HOME_WIDGET_SLOTS = ["hero", "main", "aside"];

export const HOME_WIDGET_CATALOG = [
  {
    id: "statsStrip",
    defaultLabel: "Stats strip",
    slot: "hero",
    roles: ["staff", "admin"],
    icon: "trend-up",
    defaultEnabled: true,
    description: "Live counts in the header band",
  },
  {
    id: "announcements",
    defaultLabel: "Announcements",
    slot: "main",
    roles: ["staff", "admin", "client"],
    icon: "pin",
    defaultEnabled: true,
    description: "Pinned updates from your team",
  },
  {
    id: "yourRaces",
    defaultLabel: "Your races",
    slot: "main",
    roles: ["staff", "admin"],
    requiresModule: "election",
    icon: "tv",
    defaultEnabled: true,
    description: "Live election night contests",
  },
  {
    id: "upcomingEvents",
    defaultLabel: "Upcoming events",
    slot: "main",
    roles: ["staff", "admin", "client"],
    requiresModule: "calendar",
    icon: "calendar",
    defaultEnabled: false,
    description: "Next meetings and deadlines",
  },
  {
    id: "designQueue",
    defaultLabel: "Design queue",
    slot: "main",
    roles: ["staff", "admin", "client"],
    requiresModule: "design",
    icon: "pen",
    defaultEnabled: false,
    description: "Open design requests",
  },
  {
    id: "latestPoll",
    defaultLabel: "Latest poll",
    slot: "main",
    roles: ["staff", "admin", "client"],
    requiresModule: "polling",
    icon: "trend-up",
    defaultEnabled: false,
    description: "Most recent polling snapshot",
  },
  {
    id: "tasks",
    defaultLabel: "My tasks",
    slot: "aside",
    roles: ["staff", "admin", "client"],
    icon: "check",
    defaultEnabled: true,
    description: "Your assigned to-dos",
  },
  {
    id: "quickLinks",
    defaultLabel: "Quick links",
    slot: "aside",
    roles: ["staff", "admin", "client"],
    icon: "compass",
    defaultEnabled: true,
    description: "Shortcuts to common sections",
  },
];

const CATALOG_BY_ID = Object.fromEntries(HOME_WIDGET_CATALOG.map((w) => [w.id, w]));

export const DEFAULT_HOME_LAYOUT = HOME_WIDGET_CATALOG.map((w, i) => ({
  id: w.id,
  enabled: w.defaultEnabled !== false,
  order: i,
}));

export function widgetMeta(id) {
  return CATALOG_BY_ID[id] || null;
}

/** Widgets the user can add based on role and module access. */
export function availableWidgets({ role, effectiveModules = {} }) {
  return HOME_WIDGET_CATALOG.filter((w) => {
    if (!w.roles.includes(role)) return false;
    if (w.requiresModule && !effectiveModules[w.requiresModule]) return false;
    return true;
  });
}

/**
 * Merge saved layout with the catalog, drop unavailable widgets, and append
 * any newly-added catalog entries the user hasn't seen yet.
 */
export function normalizeHomeLayout(raw, { role, effectiveModules = {} }) {
  const allowed = availableWidgets({ role, effectiveModules });
  const allowedIds = new Set(allowed.map((w) => w.id));
  const saved = Array.isArray(raw) ? raw.filter((w) => allowedIds.has(w.id)) : [];
  const byId = Object.fromEntries(saved.map((w) => [w.id, w]));

  const merged = allowed.map((cat, i) => {
    const savedRow = byId[cat.id];
    return {
      id: cat.id,
      enabled: savedRow ? savedRow.enabled !== false : cat.defaultEnabled !== false,
      order: typeof savedRow?.order === "number" ? savedRow.order : i,
      label: savedRow?.label?.trim() || cat.defaultLabel,
    };
  });

  return merged.sort((a, b) => a.order - b.order);
}

export function enabledWidgets(layout, { role, effectiveModules }) {
  return normalizeHomeLayout(layout, { role, effectiveModules }).filter((w) => w.enabled);
}

export function widgetsBySlot(layout, ctx) {
  const enabled = enabledWidgets(layout, ctx);
  const groups = { hero: [], main: [], aside: [] };
  for (const w of enabled) {
    const slot = CATALOG_BY_ID[w.id]?.slot;
    if (slot && groups[slot]) groups[slot].push(w);
  }
  for (const slot of HOME_WIDGET_SLOTS) {
    groups[slot].sort((a, b) => a.order - b.order);
  }
  return groups;
}

export function moveWidget(layout, id, direction) {
  const meta = CATALOG_BY_ID[id];
  if (!meta) return layout;
  const slotRows = layout
    .filter((w) => CATALOG_BY_ID[w.id]?.slot === meta.slot)
    .sort((a, b) => a.order - b.order);
  const idx = slotRows.findIndex((w) => w.id === id);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= slotRows.length) return layout;

  const a = slotRows[idx];
  const b = slotRows[swapIdx];
  const orderA = a.order;
  const orderB = b.order;

  return layout.map((w) => {
    if (w.id === a.id) return { ...w, order: orderB };
    if (w.id === b.id) return { ...w, order: orderA };
    return w;
  });
}

export function toggleWidget(layout, id) {
  return layout.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
}

export function relabelWidget(layout, id, label) {
  return layout.map((w) => (w.id === id ? { ...w, label } : w));
}
