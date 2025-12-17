import axios from "axios";

/**
 * =========================
 * BASE CONFIG
 * =========================
 */
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fluencyjet-sentence-master-production.up.railway.app/api";

console.log("[apiclient] Using API_BASE =", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

/**
 * =========================
 * TOKEN HANDLING
 * =========================
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * =========================
 * AUTH
 * =========================
 */
export async function loginUser(email, password) {
  const res = await api.post("/auth/login", { email, password });
  if (res.data?.token) {
    localStorage.setItem("token", res.data.token);
  }
  return res.data;
}

export async function signupUser(payload) {
  const res = await api.post("/auth/signup", payload);
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

/**
 * =========================
 * BILLING / PLANS
 * =========================
 */
export async function updateMyPlan(plan) {
  const res = await api.post("/billing/update-my-plan", { plan });
  return res.data;
}

export async function updateUserPlan(userId, plan) {
  const res = await api.post(`/admin/users/${userId}/plan`, { plan });
  return res.data;
}

export default api;
