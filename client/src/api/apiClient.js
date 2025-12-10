// client/src/api/apiClient.js

// Base URL for the backend API.
// In Railway, VITE_API_BASE_URL is set to:
//   https://fluencyjet-sentence-master-production.up.railway.app/api
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// Normalize to avoid trailing slash issues.
const API_BASE = RAW_BASE.replace(/\/$/, "");

/**
 * Low-level helper for calling the API.
 * It NEVER throws – it always returns an object with:
 *   { ok, status, message, data, token, user }
 */
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const { method = "GET", body, headers = {}, ...rest } = options;

  const fetchOptions = {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...rest,
  };

  let res;
  let data = null;

  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    console.error("Network error calling API:", err);
    return {
      ok: false,
      status: 0,
      message: "Network error. Please check your connection.",
      data: null,
    };
  }

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // Normalize shape
  const okFromBody = data && typeof data.ok === "boolean" ? data.ok : res.ok;

  if (!res.ok || okFromBody === false) {
    return {
      ok: false,
      status: res.status,
      message:
        (data && data.message) ||
        (res.status === 401
          ? "Invalid email or password."
          : `Request failed (${res.status}).`),
      data,
    };
  }

  return {
    ok: true,
    status: res.status,
    message: data && data.message,
    token: data && data.token,
    user: data && data.user,
    data,
  };
}

/* ─────────────────────────────
   STUDENT AUTH HELPERS
   Used by Login.jsx & Signup.jsx
   ───────────────────────────── */

/**
 * Signup: used by src/pages/student/Signup.jsx
 * Expects an object: { name, email, password }
 */
export async function signupUser({ name, email, password }) {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: { name, email, password },
  });
}

/**
 * Login: used by src/pages/student/Login.jsx
 * Expects an object: { email, password }
 */
export async function loginUser({ email, password }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

/* ─────────────────────────────
   GENERIC AUTH/USER HELPERS
   (optional but handy elsewhere)
   ───────────────────────────── */

export async function fetchCurrentUser() {
  return apiRequest("/auth/me", { method: "GET" });
}

/**
 * Wrapper that other pages can reuse:
 *   apiGet("/lessons")
 *   apiPost("/progress", { ... })
 */
export function apiGet(path) {
  return apiRequest(path, { method: "GET" });
}

export function apiPost(path, body) {
  return apiRequest(path, { method: "POST", body });
}

export function apiPut(path, body) {
  return apiRequest(path, { method: "PUT", body });
}

export function apiDelete(path) {
  return apiRequest(path, { method: "DELETE" });
}

/* ─────────────────────────────
   ADMIN HELPERS RE-EXPORTED
   adminApi object -> used by AdminDashboard.jsx
   ───────────────────────────── */

// Pull in everything from ./adminApi and expose it as `adminApi`
import * as adminApiModule from "./adminApi";

// So you can: import { adminApi } from "../../api/apiClient";
export const adminApi = adminApiModule;

// Also allow generic access to low-level requester
export { apiRequest as apiClient };

// Default export = low-level request function
export default apiRequest;
