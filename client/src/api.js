// client/src/api.js
import axios from "axios";
import { API_BASE_URL } from "./config";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ✅ Signup
export function signupUser(data) {
  return api.post("/api/auth/signup", data);
}

// ✅ Login
export function loginUser(data) {
  return api.post("/api/auth/login", data);
}

// ✅ Profile
export function getUserProfile(token) {
  return api.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
