// client/src/api/apiClient.js

// -----------------------------
// API base resolution
// -----------------------------
function normalizeApiBase(raw) {
  // Allow "/api" (relative) or full URLs
  const fallback = "/api";
  const base = (raw && String(raw).trim()) ? String(raw).trim() : fallback;

  // If it’s already a relative "/api" (or "/something"), keep it clean
  if (base.startsWith("/")) {
    return base.endsWith("/api") || base === "/api"
      ? base.replace(/\/$/, "")
      : `${base.replace(/\/$/, "")}/api`;
  }

  // Full URL
  const noTrailing = base.replace(/\/$/, "");
  return noTrailing.endsWith("/api") ? noTrailing : `${noTrailing}/api`;
}

function isReplitHost(hostname) {
  return (
    hostname.endsWith(".replit.dev") ||
    hostname.endsWith(".repl.co") ||
    hostname.includes("replit.dev") ||
    hostname.includes("repl.co")
  );
}

function resolveApiBase() {
  // If we are in the browser, we can decide based on hostname
  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    // On Replit, prefer SAME-ORIGIN to avoid CORS
    if (isReplitHost(host)) {
      return "/api";
    }
  }

  // Otherwise use env (Railway etc.)
  return normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
}

export const API_BASE = resolveApiBase();
console.log("[apiClient] Using API_BASE =", API_BASE);

// -----------------------------
// Token helper
// -----------------------------
function getToken() {
  return localStorage.getItem("token");
}

// -----------------------------
// Core JSON request helper
// -----------------------------
async function apiRequest(method, path, body) {
  const token = getToken();

  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // If API_BASE is relative ("/api"), this becomes "/api/xxx"
  // If API_BASE is absolute ("https://..../api"), this becomes "https://..../api/xxx"
  const url = `${API_BASE}${cleanPath}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error(data?.message || `API request failed (${res.status})`);
  }

  return data;
}

// -----------------------------
// Default API object (used everywhere)
// -----------------------------
const api = {
  get: (path) => apiRequest("GET", path),
  post: (path, body) => apiRequest("POST", path, body),
  put: (path, body) => apiRequest("PUT", path, body),
  del: (path) => apiRequest("DELETE", path),
};

export default api;
export { api };

// -----------------------------
// Generic request() export (legacy)
// Signature: request("/path", { method, headers, body })
// - If you pass a relative path, it prefixes API_BASE.
// - If you pass full http(s) URL, it uses it as-is.
// -----------------------------
export async function request(path, options = {}) {
  const token = getToken();

  const url =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

// -----------------------------
// AUTH
// -----------------------------
export const loginUser = (email, password) =>
  api.post("/auth/login", { email, password });

export const signupUser = (email, password) =>
  api.post("/auth/signup", { email, password });

export const getMe = () => api.get("/auth/me");

// -----------------------------
// BILLING (Razorpay)
// -----------------------------
export const createOrder = (plan) =>
  api.post("/billing/create-order", { plan });

export const verifyPayment = (payload) =>
  api.post("/billing/verify-payment", payload);

// -----------------------------
// Compatibility exports (don’t touch other files now)
// -----------------------------
export const updateMyPlan = (plan) => createOrder(plan);

export const updateUserPlan = (userId, plan) =>
  api.post(`/admin/users/${userId}/plan`, { plan });
