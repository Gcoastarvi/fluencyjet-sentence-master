// client/src/utils/fetch.js
import { toast } from "react-hot-toast";

// Global redirect helper
function redirectToLogin() {
  // Clear old token
  localStorage.removeItem("token");
  localStorage.removeItem("userName");

  // Go to login
  window.location.href = "/login";
}

export async function customFetch(url, options = {}) {
  try {
    const token = localStorage.getItem("token");

    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };

    // Attach token if available
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // ---- GLOBAL 401 HANDLER ----
    if (res.status === 401) {
      if (!options?.silent) {
        toast.error("Session expired — please log in again");
      }
      redirectToLogin();
      return null;
    }

    // Normal JSON response
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ customFetch error:", err);
    if (!options?.silent) toast.error("Network error");
    return { ok: false, message: "Network error" };
  }
}
