// client/src/utils/tokenWatcher.js

/**
 * Periodically checks for token validity and logs user out if expired or invalid.
 * You can expand this later to call a backend endpoint like /api/auth/verify.
 */
export function startTokenWatcher(intervalMs = 60000) {
  function checkToken() {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("🔒 No token found — redirecting to login...");
        window.location.href = "/login";
        return;
      }

      // Optional: Add expiration check if you encode expiry in JWT or store timestamp
      const expiry = localStorage.getItem("tokenExpiry");
      if (expiry && Date.now() > Number(expiry)) {
        console.warn("🔒 Token expired — logging out...");
        localStorage.removeItem("token");
        localStorage.removeItem("userName");
        window.location.href = "/login";
      }
    } catch (e) {
      console.error("Token watcher error:", e);
    }
  }

  // Check immediately on load + every minute
  checkToken();
  setInterval(checkToken, intervalMs);
}
