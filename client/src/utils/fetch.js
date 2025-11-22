export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("fj_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // Parse JSON
    const data = await res.json();

    // Global 401 handling
    if (res.status === 401) {
      localStorage.removeItem("fj_token");

      if (window?.showToast) {
        window.showToast("Session expired. Please log in again.");
      } else {
        alert("Session expired. Please log in again.");
      }

      window.location.href = "/login";
      return null;
    }

    return data;
  } catch (error) {
    console.error("API Fetch Error:", error);
    return { ok: false, error: "Fetch failed" };
  }
}
