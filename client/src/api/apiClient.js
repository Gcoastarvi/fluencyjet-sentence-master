// client/src/api/apiClient.js

/**
 * API base resolution:
 * - If VITE_API_BASE_URL is empty => use same-origin "/api" (works only if backend is on same domain)
 * - If VITE_API_BASE_URL is set => we normalize it to include "/api"
 *   Example: https://xxx.up.railway.app  -> https://xxx.up.railway.app/api
 *   Example: https://xxx.up.railway.app/api -> stays the same
 */

function normalizeApiBase(raw) {
  // Explicit empty string => same-origin
  if (raw === "") return "/api";

  const fallback = "http://localhost:5000";
  const base = (raw || fallback).replace(/\/+$/, ""); // trim trailing slashes
  return base.endsWith("/api") ? base : `${base}/api`;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

// Optional debug (helps you confirm where FE is pointing)
console.log("[apiClient] Using API_BASE =", API_BASE);

function getAuthToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

/**
 * request() supports BOTH styles:
 * 1) request("GET", "/diagnostic/quiz")
 * 2) request("/diagnostic/quiz", { method:"GET" })
 */
export async function request(methodOrPath, pathOrOptions, body = undefined, extraOptions = {}) {
  let method;
  let path;
  let options;

  // Style #2: request("/path", options)
  if (typeof methodOrPath === "string" && methodOrPath.startsWith("/")) {
    method = (pathOrOptions?.method || "GET").toUpperCase();
    path = methodOrPath;
    options = pathOrOptions || {};
  } else {
    // Style #1: request("GET", "/path", body, options)
    method = String(methodOrPath || "GET").toUpperCase();
    path = String(pathOrOptions || "");
    options = extraOptions || {};
  }

  const url = `${API_BASE}${path}`;

  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchOptions = {
    method,
    headers,
    // IMPORTANT: do NOT set credentials unless you truly use cookies
    // credentials: "include",
    ...options,
  };

  if (body !== undefined && body !== null && method !== "GET") {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);

  // Return JSON when possible, otherwise text
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    // Throw something helpful
    const msg =
      (payload && payload.message) ||
      (typeof payload === "string" && payload) ||
      `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return payload;
}

const api = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  del: (path, options) => request("DELETE", path, undefined, options),
};

export default api;
