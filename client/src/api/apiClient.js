import axios from "axios";

/* -------------------------------------------
   Base Axios Client
------------------------------------------- */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fluencyjet-sentence-master-production.up.railway.app/api";

console.log("[apiclient] Using API_BASE =", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
});

/* -------------------------------------------
   Attach JWT automatically
------------------------------------------- */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fj_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* -------------------------------------------
   AUTH HELPERS
------------------------------------------- */

export async function loginUser(email, password) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function signupUser(payload) {
  const res = await api.post("/auth/signup", payload);
  return res.data;
}

export async function fetchMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

/* -------------------------------------------
   BILLING / PLAN
------------------------------------------- */

export async function updateMyPlan(plan) {
  const res = await api.post("/billing/update-plan", { plan });
  return res.data;
}

/* -------------------------------------------
   EXPORT DEFAULT (important!)
------------------------------------------- */

export default api;
