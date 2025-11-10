// client/src/api.js
import axios from "axios";
import { API_BASE_URL } from "./config";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`, // ✅ ensures calls hit /api/auth/*
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- Auth APIs ----
export async function signupUser(data) {
  return api.post("/signup", data); // -> /api/auth/signup
}

export async function loginUser(data) {
  return api.post("/login", data); // -> /api/auth/login
}

// ---- Health check (optional) ----
export async function testHealth() {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/health`);
    console.log("✅ Backend health:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Backend unreachable:", err.message);
  }
}
