// client/src/api.js
import axios from "axios";
import { API_BASE_URL } from "./config";

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- Auth ----
export async function signupUser(data) {
  return api.post("/signup", data); // -> /api/auth/signup
}

export async function loginUser(data) {
  return api.post("/login", data); // -> /api/auth/login
}

export async function getUserProfile() {
  // -> /api/auth/me  (protected)
  return api.get("/me", { headers: authHeader() });
}

// ---- Health (optional) ----
export async function testHealth() {
  return axios.get(`${API_BASE_URL}/api/health`);
}
