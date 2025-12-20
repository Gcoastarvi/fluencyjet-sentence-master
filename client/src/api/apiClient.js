// client/src/api/apiClient.js

// -----------------------------
// Detect Replit runtime
// -----------------------------
function isReplitHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname || "";
  return (
    host.endsWith(".replit.dev") ||
    host.endsWith(".repl.co") ||
    host.includes("spock.replit.dev")
  );
}

// -----------------------------
// Base URL normalization
// -----------------------------
function normalizeApiBase(raw) {
  const fallback = "http://localhost:5000";
  const base = (raw || fallback).replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

// ✅ Key behavior:
// - If running on Replit URL → use SAME ORIGIN API to avoid CORS
// - Else → use VITE_API_BASE_URL (Railway)
const API_BASE = isReplitHost()
  ? `${window.location.origin}/api`
  : normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

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

  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;

  const res = await fetch(url, {
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
// Default API object
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
// Generic request() export (legacy imports like Paywall.jsx)
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
// Compatibility exports
// -----------------------------
export const updateMyPlan = (plan) => createOrder(plan);

export const updateUserPlan = (userId, plan) =>
  api.post(`/admin/users/${userId}/plan`, { plan });
