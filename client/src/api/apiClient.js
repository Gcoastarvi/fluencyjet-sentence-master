// client/src/api/apiClient.js

// -----------------------------
// Base URL normalization
// -----------------------------
function normalizeApiBase(raw) {
  const fallback = "http://localhost:5000";
  const base = (raw || fallback).replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
console.log("[apiClient] Using API_BASE =", API_BASE);

// -----------------------------
// Token helper
// -----------------------------
function getToken() {
  return localStorage.getItem("token");
}

// -----------------------------
// Core JSON request helper (method/path/body)
// -----------------------------
async function apiRequest(method, path, body) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
// Generic request() export (for legacy imports like Paywall.jsx)
// Signature: request("/path", { method, headers, body })
// Automatically prefixes API_BASE if you pass a relative path.
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

  if (!res.ok)
    throw new Error(data?.message || `Request failed (${res.status})`);
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
