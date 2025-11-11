// client/src/utils/tokenWatcher.js
/**
 * 🕒 Token Watcher
 * Automatically checks for token expiry and renews it using /api/auth/refresh
 * Runs in background every X milliseconds.
 */

export function startTokenWatcher(intervalMs = 60000) {
  console.log(
    "🔍 Token watcher started. Checking every",
    intervalMs / 1000,
    "sec",
  );

  async function checkToken() {
    try {
      const token = localStorage.getItem("token");
      const expiry = localStorage.getItem("tokenExpiry");

      // No token → stop here
      if (!token) return;

      const now = Date.now();
      const expiryTime = Number(expiry);

      // If expiry is within the next 5 minutes, auto-refresh
      if (expiryTime && expiryTime - now < 5 * 60 * 1000) {
        console.log("♻️ Token expiring soon, attempting refresh...");

        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (res.ok && data?.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("tokenExpiry", data.expiresAt);
          if (data.name) localStorage.setItem("userName", data.name);
          console.log(
            "✅ Token refreshed successfully at",
            new Date().toLocaleTimeString(),
          );
        } else {
          console.warn("⚠️ Token refresh failed:", data?.message);
          handleLogout();
        }
      }

      // If expired already, force logout
      if (expiryTime && now > expiryTime) {
        console.warn("⏰ Token expired — logging out.");
        handleLogout();
      }
    } catch (err) {
      console.error("Watcher error:", err);
    }
  }

  // 🔁 Run every interval
  const interval = setInterval(checkToken, intervalMs);

  // Cleanup when needed (optional)
  window.addEventListener("beforeunload", () => clearInterval(interval));
}

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("tokenExpiry");
  localStorage.removeItem("userName");
  window.location.href = "/login";
}
