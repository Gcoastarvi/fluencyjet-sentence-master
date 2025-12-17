// client/src/api/apiClient.js

const root = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
// If VITE_API_BASE_URL is set (Railway), use it. Otherwise fallback to same-origin "/api".
export const API_BASE = root ? `${root}/api` : "/api";

const TOKEN_KEY = "fj_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const token = getToken();
  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  // Debug-friendly log (keeps your console visibility)
  console.log("[apiClient] Request:", method, url, body ? body : "");
  console.log("[apiClient] Raw response:", {
    status: res.status,
    contentType,
    text,
  });

  let data = null;
  if (text) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {
        // If server accidentally returned HTML, keep data null
        data = null;
      }
    } else {
      // non-json response (html/text)
      data = { ok: false, message: text };
    }
  }

  if (!res.ok || (data && data.ok === false)) {
    const msg =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Default api client (so `import api from "@/api/apiClient"` works) */
export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;

/** Compatibility exports used across your codebase */
export async function signupUser(payloadOrEmail, password, name) {
  // Supports both:
  // signupUser({ name, email, password })
  // signupUser(email, password, name)
  const payload =
    typeof payloadOrEmail === "object"
      ? payloadOrEmail
      : { email: payloadOrEmail, password, name };

  const data = await api.post("/auth/signup", payload);
  if (data?.token) setToken(data.token);
  if (data?.plan) localStorage.setItem("fj_plan", data.plan);
  return data;
}

export async function loginUser(payloadOrEmail, password) {
  // Supports both:
  // loginUser({ email, password })
  // loginUser(email, password)
  const payload =
    typeof payloadOrEmail === "object"
      ? payloadOrEmail
      : { email: payloadOrEmail, password };

  const data = await api.post("/auth/login", payload);
  if (data?.token) setToken(data.token);
  if (data?.plan) localStorage.setItem("fj_plan", data.plan);
  return data;
}

export async function logoutUser() {
  setToken("");
  localStorage.removeItem("fj_plan");
  return { ok: true };
}

export async function getMe() {
  // backend route should be: GET /api/auth/me
  return api.get("/auth/me");
}

/** Student plan update (used in Checkout.jsx mock flow) */
export async function updateMyPlan(plan) {
  // This endpoint must exist on backend for real upgrade.
  // For now, keep it aligned with your billing namespace:
  // POST /api/billing/update-my-plan  { plan }
  return api.post("/billing/update-my-plan", { plan });
}

/** Admin plan update (used in AdminUserDetail.jsx) */
export async function updateUserPlan(userId, plan) {
  // PATCH /api/admin/users/:id/plan  { plan }
  return api.patch(`/admin/users/${userId}/plan`, { plan });
}

/** Razorpay (you’ll use these next) */
export async function createOrder(payload) {
  // POST /api/billing/create-order
  return api.post("/billing/create-order", payload);
}

export async function verifyPayment(payload) {
  // POST /api/billing/verify
  return api.post("/billing/verify", payload);
}
