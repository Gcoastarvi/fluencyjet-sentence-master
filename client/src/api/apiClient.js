// client/src/api/apiClient.js
// Minimal, stable API client for the whole app.
// Exports: api, request, loginUser, signupUser, getMe

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

if (!RAW_BASE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

// Force API namespace
const BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

if (!BASE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (!token) localStorage.removeItem("token");
    else localStorage.setItem("token", token);
  } catch {
    // ignore
  }
}

/**
 * Low-level request helper.
 * - Automatically adds Authorization header if token exists
 * - Parses JSON if possible
 * - Returns { ok, status, data, error }
 */
export async function request(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(options.headers || {});
  if (
    !headers.has("Content-Type") &&
    options.body != null &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // safe even if unused; remove later if not needed
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const error =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;

    return { ok: false, status: res.status, data, error };
  }

  return { ok: true, status: res.status, data, error: null };
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  del: (path, options = {}) => request(path, { ...options, method: "DELETE" }),
};

// Auth helpers (stable names)
// Auth helpers (stable names)
export async function loginUser(email, password) {
  const res = await api.post("/auth/login", { email, password });

  // Support BOTH possible shapes:
  // A) wrapper: { ok: true, data: { ok:true, token:"..." } }
  // B) raw:     { ok:true, token:"..." }
  const token =
    (res?.data && typeof res.data === "object" && res.data.token) ||
    (res && typeof res === "object" && res.token);

  const ok =
    (typeof res?.ok === "boolean" && res.ok) ||
    (res?.data && typeof res.data.ok === "boolean" && res.data.ok === true) ||
    (res && typeof res.ok === "boolean" && res.ok === true);

  if (ok && token) setToken(token);

  return res;
}

export async function signupUser(payload) {
  // payload expected: { name?, email, password, ... }
  const res = await api.post("/auth/signup", payload);
  if (res.ok && res.data && typeof res.data === "object" && res.data.token) {
    setToken(res.data.token);
  }
  return res;
}

export async function getMe() {
  return api.get("/auth/me");
}
// --- Compatibility exports (temporary, to avoid build breakage) ---

export async function updateMyPlan() {
  throw new Error(
    "updateMyPlan is not implemented yet. This is a placeholder export.",
  );
}
export async function updateUserPlan() {
  throw new Error(
    "updateUserPlan is not implemented yet. This is a placeholder export.",
  );
}
