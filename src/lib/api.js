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

export function withClient(path, clientId) {
  const sep = path.includes("?") ? "&" : "?";
  return path + sep + "clientId=" + encodeURIComponent(clientId || "all");
}
