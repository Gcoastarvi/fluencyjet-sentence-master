async function login(email, password) {
  try {
    const API_BASE =
      import.meta.env.VITE_API_BASE_URL ||
      "https://fluencyjet-sentence-master-production-de09.up.railway.app/api";

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Raw response:", text);
      return false;
    }

    if (!res.ok || !data.token) {
      console.error("Login failed:", data);
      return false;
    }

    localStorage.setItem("fj_token", data.token);
    decodeAndSetUser(data.token);

    return true;
  } catch (err) {
    console.error("Login request failed", err);
    return false;
  }
}
