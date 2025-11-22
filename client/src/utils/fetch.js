// client/src/utils/fetch.js
import { toast } from "react-hot-toast";

/**
 * Redirect the user to login when their session is invalid/expired.
 */
function redirectToLogin() {
  try {
    // Clear any auth-related data
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
  } catch (err) {
    console.warn("Failed to clear localStorage on logout:", err);
  }

  // Go to login page
  window.location.href = "/login";
}

/**
 * customFetch
 * -----------
 * A thin wrapper around fetch that:
 * - Automatically attaches the JWT token from localStorage as Authorization: Bearer <token>
 * - Sends cookies (for refresh token / hybrid auth) via credentials: "include"
 * - Shows a toast + redirects to /login on 401 (expired/invalid token)
 * - Shows a generic "Network error" toast on fetch failures (unless options.silent = true)
 *
 * Usage:
 *   const res = await customFetch(`${API_BASE}/api/dashboard/summary`);
 */
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
      credentials: "include", // keep cookie-based refresh flow alive
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
    if (!options?.silent) {
      toast.error("Network error");
    }
    return { ok: false, message: "Network error" };
  }
}
