// client/src/api/apiClient.js

// Always end up with ".../api"
function normalizeApiBase(raw) {
  const cleaned = (raw || "").trim().replace(/\/$/, "");

  // If VITE_API_BASE_URL is blank in Replit, use same-origin.
  // This avoids CORS completely.
  const base = cleaned || window.location.origin;

  return base.endsWith("/api") ? base : `${base}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
console.log("[apiClient] Using API_BASE =", API_BASE);

function getToken() {
  // support both keys (you’ve used both historically)
  return localStorage.getItem("fj_token") || localStorage.getItem("token");
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
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

// Default client
const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;
export { api };

// Auth helpers
export const loginUser = (email, password) =>
  api.post("/auth/login", { email, password });
export const signupUser = (name, email, password) =>
  api.post("/auth/signup", { name, email, password });
export const getMe = () => api.get("/auth/me");

// Diagnostic helpers (use these from your Diagnostic page)
export const getDiagnosticQuestions = () => api.get("/diagnostic/questions");
export const submitDiagnostic = (answers) =>
  api.post("/diagnostic/submit", { answers });

// Billing
export const createOrder = (plan, amount) =>
  api.post("/billing/create-order", { plan, amount });
export const verifyPayment = (payload) =>
  api.post("/billing/verify-payment", payload);

// Backward-compat names (so older imports don’t crash)
export const updateMyPlan = (plan) => createOrder(plan);
export const updateUserPlan = (userId, plan) =>
  api.patch(`/admin/users/${userId}/plan`, { plan });
