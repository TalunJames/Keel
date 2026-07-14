const BASE = "/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Auth is carried entirely by the server's httpOnly session cookie. The token
// is never stored in localStorage/sessionStorage or attached as a Bearer
// header, so an XSS payload cannot read or exfiltrate a session token.
export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error || res.statusText || "Request failed", res.status);
  }
  return data;
}

/** Download a CSV or other binary/text export from the API. */
export async function downloadExport(path, body, filename) {
  const res = await fetch(BASE + path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* csv error body */ }
    throw new ApiError(data?.error || res.statusText || "Export failed", res.status);
  }
  const blob = await res.blob();
  const count = res.headers.get("X-Export-Count");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { count: count ? Number(count) : null };
}

export const authApi = {
  login: (email, password, remember = false) =>
    api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    }),
  logout: () => api("/auth/logout", { method: "POST" }),
  me: () => api("/auth/me"),
};

export const setupApi = {
  status: () => api("/setup/status"),
  complete: (body) => api("/setup/complete", { method: "POST", body: JSON.stringify(body) }),
};

export const inviteApi = {
  get: (token) => api("/invite/" + encodeURIComponent(token)),
  accept: (token, body) =>
    api("/invite/" + encodeURIComponent(token) + "/accept", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const usersAdminApi = {
  invite: (body) => api("/admin/users/invite", { method: "POST", body: JSON.stringify(body) }),
  resendInvite: (userId) => api("/admin/users/" + encodeURIComponent(userId) + "/resend-invite", { method: "POST" }),
  remove: (userId) => api("/admin/users/" + encodeURIComponent(userId), { method: "DELETE" }),
};

export const accountApi = {
  me: () => api("/account/me"),
  update: (patch) => api("/account/me", { method: "PATCH", body: JSON.stringify(patch) }),
  updateClientOrder: (clientOrder) =>
    api("/account/me", { method: "PATCH", body: JSON.stringify({ clientOrder }) }),
  calendar: (start, days = 42) =>
    api(`/account/calendar?start=${encodeURIComponent(start)}&days=${days}`),
};

export const loginAnnouncementApi = {
  get: () => api("/login-announcement"),
  set: (announcement) =>
    api("/login-announcement", { method: "PUT", body: JSON.stringify(announcement) }),
};

export const versionApi = {
  get: () => api("/version"),
};

export const clientsApi = {
  list: () => api("/clients"),
  create: (body) => api("/admin/clients", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api("/admin/clients/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) }),
};

export const teamApi = {
  list: () => api("/team"),
};

export const modulesApi = {
  get: (clientId) => {
    const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    return api("/modules" + q);
  },
  set: (role, modules) =>
    api("/modules/" + role, { method: "PUT", body: JSON.stringify({ modules }) }),
};

export const accessApi = {
  userOverrides: (userId, clientId) => {
    const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    return api(`/admin/users/${userId}/access${q}`);
  },
  setUserOverrides: (userId, clientId, modules) =>
    api(`/admin/users/${userId}/access`, {
      method: "PUT",
      body: JSON.stringify({ clientId, modules }),
    }),
};

export const badgesApi = {
  get: (clientId) => api("/badges?clientId=" + encodeURIComponent(clientId || "all")),
};

export const designApi = {
  list: (clientId) => api(withClient("/design/requests", clientId)),
  get: (id) => api(`/design/requests/${id}`),
  create: (body) => api("/design/requests", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/design/requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  claim: (id) => api(`/design/requests/${id}/claim`, { method: "POST" }),
  stats: (clientId) => api(withClient("/design/stats", clientId)),
  deskStats: () => api("/design/desk-stats"),
  myQueue: () => api("/design/my-queue"),
  pool: (clientId) => api(withClient("/design/pool", clientId)),
  designers: () => api("/design/designers"),
  addProof: (id, body) => api(`/design/requests/${id}/proofs`, { method: "POST", body: JSON.stringify(body) }),
  linkPeriscopeShare: (requestId, proofId, periscopeShareId) =>
    api(`/design/requests/${requestId}/proofs/${proofId}`, {
      method: "PATCH",
      body: JSON.stringify({ periscopeShareId }),
    }),
  addComment: (id, body) => api(`/design/requests/${id}/comments`, { method: "POST", body: JSON.stringify(body) }),
  upload: async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
    return api("/design/uploads", {
      method: "POST",
      body: JSON.stringify({ name: file.name, dataUrl }),
    });
  },
};

const crudApi = (base) => ({
  list: (clientId) => api(withClient(base, clientId)),
  create: (body) => api(base, { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id) => api(`${base}/${id}`, { method: "DELETE" }),
});

export const calendarApi = crudApi("/calendar/events");
export const mediaApi = crudApi("/media/mentions");
export const stakeholdersApi = crudApi("/stakeholders");
export const resourcesApi = crudApi("/resources");
export const onboardingApi = crudApi("/onboarding/programs");

export const electionLiveApi = {
  status: () => api("/election/live/status"),
  contests: (patterns) => {
    const params = patterns?.length
      ? `?patterns=${encodeURIComponent(patterns.join(","))}`
      : "";
    return api("/election/live/contests" + params);
  },
  results: ({ contestKey, contestName } = {}) => {
    const params = new URLSearchParams();
    if (contestKey) params.set("contestKey", contestKey);
    if (contestName) params.set("contestName", contestName);
    const q = params.toString();
    return api("/election/live/results" + (q ? `?${q}` : ""));
  },
};

export const electionCollectorApi = {
  status: () => api("/election/collector/status"),
  config: () => api("/election/collector/config"),
  updateConfig: (patch) =>
    api("/election/collector/config", { method: "PUT", body: JSON.stringify(patch) }),
  start: (patch) =>
    api("/election/collector/start", { method: "POST", body: JSON.stringify(patch || {}) }),
  stop: () => api("/election/collector/stop", { method: "POST" }),
  once: (patch) =>
    api("/election/collector/once", { method: "POST", body: JSON.stringify(patch || {}) }),
  discover: (patch) =>
    api("/election/collector/discover", { method: "POST", body: JSON.stringify(patch || {}) }),
  test: (patch) =>
    api("/election/collector/test", { method: "POST", body: JSON.stringify(patch || {}) }),
};

export function withClient(path, clientId) {
  const sep = path.includes("?") ? "&" : "?";
  return path + sep + "clientId=" + encodeURIComponent(clientId || "all");
}
