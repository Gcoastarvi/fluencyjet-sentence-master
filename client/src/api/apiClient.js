const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function apiClient(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  options.headers = {
    ...defaultHeaders,
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, options);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Server did not return JSON");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");

    return data;
  } catch (err) {
    console.error("API request failed:", err);
    throw err;
  }
}

export default apiClient;
