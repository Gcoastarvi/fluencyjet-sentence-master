// client/src/utils/fetch.js

// Automatically choose API base URL depending on environment:
const API_BASE =
  window.location.origin ||
  "https://fluencyjet-sentence-master-production.up.railway.app";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    console.warn("Token expired or invalid → redirecting to login");
    localStorage.removeItem("token");
    localStorage.removeItem("tokenExpiry");
    localStorage.removeItem("userName");
    window.location.href = "/login";
    return;
  }

  return res.json();
}
