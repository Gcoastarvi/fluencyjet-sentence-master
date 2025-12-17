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
// Core request helper
// -----------------------------
function getToken() {
  return localStorage.getItem("token");
}

async function request(method, path, body) {
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

  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.message || "API request failed");
  }

  return data;
}

// -----------------------------
// Default API object
// -----------------------------
const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
};

export default api;

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
// (to avoid touching many files now)
// -----------------------------
export const updateMyPlan = (plan) => createOrder(plan);

export const updateUserPlan = (userId, plan) =>
  api.post(`/admin/users/${userId}/plan`, { plan });
