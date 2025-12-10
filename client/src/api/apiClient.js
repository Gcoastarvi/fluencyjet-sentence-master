// client/src/api/apiClient.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fluencyjet-sentence-master-production.up.railway.app/api";

console.log("[apiClient] Using API_BASE =", API_BASE);

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE}${path}`;
  console.log("[apiClient] Request:", method, url, body);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  console.log("[apiClient] Raw response:", {
    status: res.status,
    contentType,
    text,
  });

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("[apiClient] JSON parse error:", err);
      throw new Error("Server returned invalid response");
    }
  }

  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.message) || "Request failed");
  }

  return data;
}

export function signupUser({ name, email, password }) {
  return request("/auth/signup", {
    method: "POST",
    body: { name, email, password },
  });
}

export function loginUser({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}
