const CANON_KEYS = ["token", "fj_token", "access_token"];

export function setToken(token) {
  if (!token) return;
  localStorage.setItem("token", token);
  // Temporary backward compatibility:
  localStorage.setItem("fj_token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("fj_token");
  localStorage.removeItem("access_token");
}

export function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("fj_token") ||
    localStorage.getItem("access_token")
  );
}
