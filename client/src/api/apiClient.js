// client/src/api/apiClient.js

const RAW_BASE = import.meta.env.VITE_API_BASE_URL; // e.g. https://xxx.up.railway.app or https://xxx.up.railway.app/api

const API_BASE = RAW_BASE?.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

console.log("[apiClient] Using API_BASE =", API_BASE);

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE}${path}`;
  const token = localStorage.getItem("fj_token");

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("[apiClient] JSON parse error:", err, "text=", text);
      throw new Error("Server returned invalid response");
    }
  }

  if (!res.ok || (data && data.ok === false)) {
    if (data?.code === "XP_CAP_REACHED") {
      const err = new Error("XP cap reached");
      err.code = "XP_CAP_REACHED";
      throw err;
    }
    throw new Error((data && data.message) || `Request failed (${res.status})`);
  }

  return data;
}

/** ✅ Default client (used by AuthContext): import api from "@/api/apiClient" */
const api = {
  get: (path, opts = {}) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts = {}) =>
    request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts = {}) =>
    request(path, { ...opts, method: "PATCH", body }),
};

export default api;

/** ✅ Named exports (used by SignupModal / other pages) */
export function signupUser({ name, email, password }) {
  return request("/auth/signup", {
    method: "POST",
    body: { name, email, password },
  });
}

export function loginUser({ email, password }) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function me() {
  return request("/auth/me", { method: "GET" });
}

// Billing (Razorpay)
export async function createOrder({ plan = "PRO", amount } = {}) {
  return request("/billing/create-order", {
    method: "POST",
    body: { plan, amount },
  });
}

export async function verifyPayment(payload) {
  return request("/billing/verify-payment", { method: "POST", body: payload });
}
