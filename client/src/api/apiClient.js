// client/src/api/apiClient.js

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// Example: https://fluencyjet-sentence-master-production.up.railway.app/api

const AUTH = `${BASE_URL}/auth`; // → /api/auth

// ---------------------------
// STUDENT SIGNUP
// ---------------------------
export async function signupUser(data) {
  const res = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("Server returned invalid response");
  }

  if (!res.ok) {
    throw new Error(body.message || "Signup failed");
  }

  return body;
}

// ---------------------------
// STUDENT LOGIN
// ---------------------------
export async function loginUser(email, password) {
  const res = await fetch(`${AUTH}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("Server returned invalid response");
  }

  if (!res.ok) {
    throw new Error(body.message || "Invalid email or password");
  }

  return body;
}
