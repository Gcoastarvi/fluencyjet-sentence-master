// client/src/utils/authRedirect.js

/** If already logged in, send user to /dashboard (used on /login and /signup). */
export function autoRedirectIfLoggedIn() {
  try {
    const token = localStorage.getItem("token");
    if (token) window.location.href = "/dashboard";
  } catch {
    /* no-op */
  }
}

/** Guard for pages that should require auth if you want to call it imperatively. */
export function requireAuth() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    return true;
  } catch {
    window.location.href = "/login";
    return false;
  }
}

/** Logout helper for header buttons, etc. */
export function logoutAndRedirect() {
  try {
    localStorage.removeItem("token");
  } finally {
    window.location.href = "/login";
  }
}
