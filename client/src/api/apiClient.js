// client/src/api/apiClient.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fluencyjet-sentence-master-production-de09.up.railway.app/api";

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

  const text = await res.text(); // <-- read raw first

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("NON-JSON response:", text);
    throw new Error("Server returned HTML instead of JSON (wrong API URL)");
  }

  if (!res.ok) {
    throw new Error(json.message || "Request failed");
  }

  return json;
}
