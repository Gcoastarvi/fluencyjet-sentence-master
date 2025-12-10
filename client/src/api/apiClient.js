// client/src/api/apiClient.js

// ✅ Always talk to the same host that served the frontend
//    e.g. https://fluencyjet-sentence-master-production-de09.up.railway.app
const BASE_URL = "/api";

// ---------------------------
// STUDENT SIGNUP
// ---------------------------
export async function signupUser(data) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
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

  // body = { ok: true, token, user: {…} }
  return body;
}

// ---------------------------
// STUDENT LOGIN
// ---------------------------
export async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
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
    // backend sends { ok:false, message:"Invalid email or password" }
    throw new Error(body.message || "Invalid email or password");
  }

  // body = { ok: true, token, user: {…} }
  return body;
}
