const BASE = "/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

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

export const authApi = {
  login: (email, password, remember = false) =>
    api("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember }) }),
  logout: () => api("/auth/logout", { method: "POST" }),
  me: () => api("/auth/me"),
};

export const setupApi = {
  status: () => api("/setup/status"),
  complete: (body) => api("/setup/complete", { method: "POST", body: JSON.stringify(body) }),
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
};

export const modulesApi = {
  get: () => api("/modules"),
  set: (role, modules) =>
    api("/modules/" + role, { method: "PUT", body: JSON.stringify({ modules }) }),
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
