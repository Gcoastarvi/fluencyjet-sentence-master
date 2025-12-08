const API_BASE = "/api"; // your backend prefix

export async function apiClient(endpoint, { body, method = "GET" } = {}) {
  const token = localStorage.getItem("fj_token");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }

  return res.json();
}
