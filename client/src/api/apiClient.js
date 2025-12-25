// client/src/api/apiClient.js
// FINAL SAFE VERSION — NO TOP-LEVEL AWAIT

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
if (!RAW_BASE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

// Ensure /api suffix
const BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

/* ───────────────────────────────
   Token helpers
─────────────────────────────── */

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

/* ───────────────────────────────
   Core request helper
─────────────────────────────── */

export async function request(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(options.headers || {});

  // Content-Type
  if (
    !headers.has("Content-Type") &&
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  // Authorization
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  } catch {
    data = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data,
      error: data?.message || data?.error || `Request failed (${res.status})`,
    };
  }

  return { ok: true, status: res.status, data };
}

/* ───────────────────────────────
   API shortcuts
─────────────────────────────── */

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

/* ───────────────────────────────
   Auth helpers
─────────────────────────────── */

export async function loginUser(email, password) {
  const res = await api.post("/auth/login", { email, password });

  if (!res.ok || !res.data?.token) {
    throw new Error(res.data?.message || "Login failed");
  }

  setToken(res.data.token);

  localStorage.setItem(
    "user",
    JSON.stringify({
      email: res.data.email,
      plan: res.data.plan || "FREE",
    }),
  );

  return res.data;
}

export async function signupUser(payload) {
  const res = await api.post("/auth/signup", payload);
  if (res.ok && res.data?.token) {
    setToken(res.data.token);
  }
  return res;
}

export async function getMe() {
  return api.get("/auth/me");
}

/* Temporary compatibility exports */
export async function updateMyPlan() {
  throw new Error("updateMyPlan not implemented");
}
export async function updateUserPlan() {
  throw new Error("updateUserPlan not implemented");
}
