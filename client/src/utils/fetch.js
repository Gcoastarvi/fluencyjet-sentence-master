// client/src/utils/fetch.js

// Optional toast import — protected so it won’t crash build if missing
let toast = { error: console.error };
try {
  const realToast = require("react-hot-toast");
  toast = realToast;
} catch (_) {}

// --------------------------------------
// Basic fetch (no auth)
// --------------------------------------
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

// --------------------------------------
// Authenticated fetch (used everywhere)
// --------------------------------------
export async function apiFetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(options.headers || {}),
    },
    ...options,
  });

  // Auto-logout on token expiration
  if (res.status === 401) {
    toast.error("Session expired. Please log in again.");
    localStorage.removeItem("token");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const msg = `API error (${res.status})`;
    toast.error(msg);
    throw new Error(msg);
  }

  return res.json();
}
