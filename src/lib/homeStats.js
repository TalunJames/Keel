export const HOME_STAT_CATALOG = [
  { id: "racesTonight", defaultLabel: "Live races", statKey: "racesTonight" },
  { id: "openProofs", defaultLabel: "Open proofs", statKey: "openProofs" },
  { id: "tasksDue", defaultLabel: "Tasks due", statKey: "tasksDue" },
];

export const DEFAULT_HOME_STATS = HOME_STAT_CATALOG.map((s) => ({
  id: s.id,
  label: s.defaultLabel,
  enabled: true,
}));

export function normalizeHomeStats(raw) {
  if (!Array.isArray(raw)) return DEFAULT_HOME_STATS;
  const byId = Object.fromEntries(raw.map((s) => [s.id, s]));
  return HOME_STAT_CATALOG.map((cat) => {
    const saved = byId[cat.id];
    return {
      id: cat.id,
      label: saved?.label?.trim() || cat.defaultLabel,
      enabled: saved?.enabled !== false,
    };
  });
}
