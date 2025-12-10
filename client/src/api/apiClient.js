// client/src/api/apiClient.js

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ...

export async function loginUser(data) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!res.ok) {
    // Try very hard to extract a meaningful error message
    let message = `Login failed (${res.status})`;

    try {
      const text = await res.text();

      try {
        const json = JSON.parse(text);
        if (json && json.message) {
          message = json.message;
        } else if (json && json.error) {
          message = json.error;
        }
      } catch {
        // Not JSON – maybe plain text / HTML error
        if (text && !text.startsWith("<!DOCTYPE")) {
          message = text;
        }
      }
    } catch {
      // ignore – fall back to default message
    }

    throw new Error(message);
  }

  // Success → should be { user, token? } depending on your route
  return res.json();
}
