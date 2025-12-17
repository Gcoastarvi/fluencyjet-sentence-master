// client/src/api/apiClient.js

// Normalizes base URL so we ALWAYS end up with ".../api"
function normalizeApiBase(raw) {
  const fallback = "http://localhost:5000";
  const base = (raw || fallback).replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

// Debug (helps you verify instantly)
console.log("[apiclient] Using API_BASE =", API_BASE);

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (data && data.message) ||
      (typeof data === "string" ? data : null) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

/** ✅ Default export (so `import api from ...` works) */
const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;

/** ✅ Named export (so `import { api } from ...` also works) */
export { api };

/** ---------------------------
 *  AUTH HELPERS (used by Login / Signup / AuthContext)
 * -------------------------- */
export const loginUser = (email, password) =>
  api.post("/auth/login", { email, password });

export const signupUser = (email, password) =>
  api.post("/auth/signup", { email, password });

export const getMe = () => api.get("/auth/me");

/** ---------------------------
 *  BILLING (matches your server/routes/billing.js)
 * -------------------------- */
export const createOrder = (plan) =>
  api.post("/billing/create-order", { plan });

export const verifyPayment = (payload) =>
  api.post("/billing/verify-payment", payload);

/**
 * Backward-compat exports (to stop build failures in older pages)
 * Keep these until we refactor pages cleanly.
 */
export const updateMyPlan = (plan) => createOrder(plan);

/**
 * Admin page expects this name. Your backend route may differ,
 * but exporting it prevents build from failing.
 */
export const updateUserPlan = (userId, plan) =>
  api.post(`/admin/users/${userId}/plan`, { plan });
