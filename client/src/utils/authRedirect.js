// client/src/utils/authRedirect.js
import { getUserProfile } from "../api";

/**
 * Checks if user already logged in (token present & valid).
 * If valid → redirect to /dashboard.
 * If invalid → clear token.
 */
// client/src/utils/authRedirect.js
export function autoRedirectIfLoggedIn() {
  const token = localStorage.getItem("token");
  if (token) {
    window.location.href = "/dashboard";
  }
}

  try {
    const res = await getUserProfile();
    if (res?.data?.user || res?.data?.name) {
      window.location.href = "/dashboard";
    } else {
      localStorage.removeItem("token");
    }
  } catch (err) {
    console.warn("Token expired or invalid:", err.message);
    localStorage.removeItem("token");
  }
}
