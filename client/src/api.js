// client/src/api.js
import axios from "axios";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "fj_token"; // NEW canonical key
const LEGACY_KEY = "token"; // keep for backward compatibility

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    // store in BOTH keys so old + new code paths work
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LEGACY_KEY, token);
  } catch {
    // ignore
  }
}

function authHeader() {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- Auth ----
export async function signupUser(data) {
  const res = await api.post("/signup", data); // -> /api/auth/signup
  if (res?.data?.token) setStoredToken(res.data.token);
  return res;
}

export async function loginUser(data) {
  const res = await api.post("/login", data); // -> /api/auth/login
  if (res?.data?.token) setStoredToken(res.data.token);
  return res;
}

export async function getUserProfile() {
  // -> /api/auth/me (protected)
  return api.get("/me", { headers: authHeader() });
}

// ---- Health (optional) ----
export async function testHealth() {
  return axios.get(`${API_BASE_URL}/api/health`);
}

// Optional: if you have a logout button somewhere using api.js
export function logoutUser() {
  setStoredToken(null);
}
