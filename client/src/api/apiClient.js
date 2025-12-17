// client/src/api/apiClient.js

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

console.log("[apiClient] Using API_BASE =", API_BASE);

async function request(path, options = {}) {
  const token = localStorage.getItem("fj_token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Invalid JSON from server");
  }

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
};

export default api;
