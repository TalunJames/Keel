/** Clients from the API excluding the synthetic "All Clients" row. */
export function realClients(clients) {
  return (clients || []).filter((c) => c.id !== "all");
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
