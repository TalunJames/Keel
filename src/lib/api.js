const BASE = "/api";
const TOKEN_SESSION = "keel_token";
const TOKEN_LOCAL = "keel_token_persist";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_LOCAL) || sessionStorage.getItem(TOKEN_SESSION) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token, { remember = false } = {}) {
  try {
    if (!token) {
      sessionStorage.removeItem(TOKEN_SESSION);
      localStorage.removeItem(TOKEN_LOCAL);
      return;
    }
    sessionStorage.setItem(TOKEN_SESSION, token);
    if (remember) localStorage.setItem(TOKEN_LOCAL, token);
    else localStorage.removeItem(TOKEN_LOCAL);
  } catch {
    /* private browsing */
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export async function api(path, options = {}) {
  const token = getStoredToken();
  const res = await fetch(BASE + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
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

export const authApi = {
  login: async (email, password, remember = false) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    if (data?.token) setAuthToken(data.token, { remember });
    return data;
  },
  logout: async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      clearAuthToken();
    }
  },
  me: () => api("/auth/me"),
};

export const setupApi = {
  status: () => api("/setup/status"),
  complete: async (body) => {
    const data = await api("/setup/complete", { method: "POST", body: JSON.stringify(body) });
    if (data?.token) setAuthToken(data.token, { remember: true });
    return data;
  },
};

export const accountApi = {
  me: () => api("/account/me"),
  update: (patch) => api("/account/me", { method: "PATCH", body: JSON.stringify(patch) }),
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
