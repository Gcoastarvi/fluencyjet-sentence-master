// client/src/utils/tokenWatcher.js
/**
 * 🕒 Token Watcher + Toast Event
 * Checks token expiry and auto-refreshes using /api/auth/refresh.
 * Emits a window event "sessionRefreshed" when refresh succeeds.
 */

export function startTokenWatcher(intervalMs = 60000) {
  console.log("🔍 Token watcher running every", intervalMs / 1000, "sec");

  async function checkToken() {
    try {
      const token = localStorage.getItem("token");
      const expiry = localStorage.getItem("tokenExpiry");
      if (!token) return;

      const now = Date.now();
      const expiryTime = Number(expiry);

      // 🔄 Refresh 5 min before expiry
      if (expiryTime && expiryTime - now < 5 * 60 * 1000) {
        console.log("♻️ Refreshing token...");
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
          console.log("✅ Token refreshed", new Date().toLocaleTimeString());

          // 🔔 Dispatch toast event
          window.dispatchEvent(new CustomEvent("sessionRefreshed"));
        } else {
          console.warn("⚠️ Refresh failed:", data?.message);
          handleLogout();
        }
      }

      // ⏰ If expired already → logout
      if (expiryTime && now > expiryTime) {
        console.warn("⏰ Token expired — logging out");
        handleLogout();
      }
    } catch (err) {
      console.error("Watcher error:", err);
    }
  }

  const interval = setInterval(checkToken, intervalMs);
  window.addEventListener("beforeunload", () => clearInterval(interval));
}

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("tokenExpiry");
  localStorage.removeItem("userName");
  window.location.href = "/login";
}
