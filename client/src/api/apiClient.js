cd ~/workspace

cat > client/src/api/apiClient.js <<'EOF'
// client/src/api/apiClient.js

// -----------------------------
// Base URL normalization
// -----------------------------
function normalizeApiBase(raw) {
  // If env is empty, default to SAME ORIGIN (Replit hosted preview / prod host)
  const fallback =
    (typeof window !== "undefined" && window.location?.origin) ||
    "http://localhost:5000";

  const base = (raw || fallback).replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
console.log("[apiClient] Using API_BASE =", API_BASE);

// -----------------------------
// Token helpers (support both old + new keys)
// -----------------------------
function getToken() {
  return (
    localStorage.getItem("token") || // current standard
    localStorage.getItem("fj_token") || // older builds
    ""
  );
}

// -----------------------------
// Low-level request (BACKWARD COMPAT)
// Many modules expect: request(path, options)
// -----------------------------
export async function request(path, options = {}) {
  const token = getToken();

  const method = options.method || "GET";
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const body =
    options.body === undefined
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (typeof data === "string" ? data : null) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// -----------------------------
// Default API object
// -----------------------------
const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;
export { api };

// -----------------------------
// AUTH (used by Login / Signup / AuthContext)
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
// Compatibility exports (reduce edits elsewhere)
// -----------------------------
export const updateMyPlan = (plan) => createOrder(plan);

export const updateUserPlan = (userId, plan) =>
  api.post(`/admin/users/${userId}/plan`, { plan });

// Optional: some older code used "me"
export const me = () => getMe();
EOF
