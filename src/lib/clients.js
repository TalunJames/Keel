/** Clients from the API excluding the synthetic "All Clients" row. */
export function realClients(clients) {
  return (clients || []).filter((c) => c.id !== "all");
}

/**
 * Apply a user's saved client order. "All Clients" stays first when present;
 * unknown or new clients are appended in their original order.
 */
export function sortClientsByOrder(clients, order) {
  const list = clients || [];
  if (!order?.length) return list;

  const byId = new Map(list.map((c) => [c.id, c]));
  const result = [];
  const seen = new Set();

  if (byId.has("all")) {
    result.push(byId.get("all"));
    seen.add("all");
  }

  for (const id of order) {
    if (id === "all" || seen.has(id)) continue;
    const c = byId.get(id);
    if (c) {
      result.push(c);
      seen.add(id);
    }
  }

  for (const c of list) {
    if (!seen.has(c.id)) result.push(c);
  }
  return result;
}

/**
 * Pick the active client id from the list and stored preference.
 * When only one real client exists, always use it (voter/polling require a specific client).
 */
export function resolveClientSelection(clients, clientId) {
  const list = clients || [];
  const real = realClients(list);
  const ids = new Set(list.map((c) => c.id));

  if (real.length === 1 && (clientId === "all" || !ids.has(clientId))) {
    return real[0].id;
  }
  if (clientId !== "all" && !ids.has(clientId)) {
    return real[0]?.id || "all";
  }
  return clientId;
}
