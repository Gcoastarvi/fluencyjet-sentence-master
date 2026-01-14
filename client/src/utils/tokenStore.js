const CANON_KEYS = ["token", "fj_token", "access_token"];

export function getToken() {
  try {
    for (const k of CANON_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
    return "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (!token) return;
    // Canonical write
    localStorage.setItem("token", token);
    // Optional: remove legacy to avoid confusion (you can keep for now if you want)
    // localStorage.removeItem("fj_token");
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("fj_token");
    localStorage.removeItem("access_token");
  } catch {}
}
