// client/src/api/apiClient.js
// FINAL SAFE VERSION — NO TOP-LEVEL AWAIT
import { getToken, setToken } from "@/utils/tokenStore";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// ✅ Monolith-safe default: same origin
const origin =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

const API_BASE = RAW_BASE || origin;

// Ensure /api suffix
const BASE = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

/* ───────────────────────────────
   Token helpers (single source of truth)
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
  const existingAuth = headers.get("Authorization");
  if (token && (!existingAuth || existingAuth.trim() === "")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "include",
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

  // ✅ Auto-save token if response includes one (login/register)
  if (data && typeof data === "object" && data.token) {
    setToken(data.token);
  }

  // Fire a global event after XP update so dashboards can refresh instantly
  if (
    res.ok &&
    typeof window !== "undefined" &&
    typeof path === "string" &&
    path.includes("/progress/update")
  ) {
    window.dispatchEvent(new CustomEvent("fj:xp_updated"));
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
