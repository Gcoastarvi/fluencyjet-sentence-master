// client/src/hooks/useApi.js
import { useState, useEffect, useCallback } from "react";

// ✅ If VITE_API_BASE_URL is not set, default to same origin ("")
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

/* ───────────────────── AUTH HELPERS ───────────────────── */

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("expiresAt");
  window.location.href = "/login";
}

// 🔄 Auto-refresh token helper
async function refreshToken() {
  try {
    const token = getToken();
    if (!token) return null;

    const res = await fetch(`${API}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!data.ok) return null;

    setToken(data.token);
    localStorage.setItem("expiresAt", data.expiresAt);
    return data.token;
  } catch {
    return null;
  }
}

/* ───────────────────── BASE API WRAPPER ───────────────────── */

export async function apiRequest(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API}${path}`, { ...options, headers });

  // If token expired → refresh & retry
  if (res.status === 401) {
    const newToken = await refreshToken();
    if (!newToken) {
      clearAuth();
      return null;
    }

    const retryHeaders = {
      ...headers,
      Authorization: `Bearer ${newToken}`,
    };

    res = await fetch(`${API}${path}`, { ...options, headers: retryHeaders });
  }

  return res.json();
}

/* ───────────────────── NEW: useApi HOOK ───────────────────── */
/**
 * Lightweight wrapper used by pages like Dashboard, Lessons, LessonDetail.
 * Usage:
 *   const api = useApi();
 *   const data = await api.get("/dashboard/summary");
 */
export function useApi() {
  async function request(method, url, body) {
    const opts = { method };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    // Prefix with /api so callers only pass logical paths like "/lessons"
    return apiRequest(`/api${url}`, opts);
  }

  return {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body),
    put: (url, body) => request("PUT", url, body),
    del: (url) => request("DELETE", url),
  };
}

/* ───────────────────── 1) useLessons() ───────────────────── */

export function useLessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const data = await apiRequest("/api/lessons");
    if (data?.ok) setLessons(data.lessons);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  return { lessons, loading, reload: loadLessons };
}

/* ───────────────── 2) useLessonDetail(id) ───────────────── */

export function useLessonDetail(lessonId) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);

    const data = await apiRequest(`/api/lessons/${lessonId}`);
    if (data?.ok) setLesson(data.lesson);

    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  return { lesson, loading, reload: load };
}

/* ───────────────────── 3) useDashboard() ───────────────────── */

export function useDashboard() {
  const [state, setState] = useState({
    profile: null,
    totals: null,
    streak: null,
    recommended: null,
    loading: true,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const data = await apiRequest("/api/dashboard");

    if (data?.ok) {
      setState({
        profile: data.profile,
        totals: data.totals,
        streak: data.streak,
        recommended: data.recommended,
        loading: false,
      });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/* ───────────────────── 4) useXP() ───────────────────── */

export function useXP() {
  const [xp, setXP] = useState({ week: 0, month: 0, lifetime: 0 });

  const reloadXP = useCallback(async () => {
    const data = await apiRequest("/api/xp/balance");
    if (data?.ok) {
      setXP({
        week: data.balance.week_xp,
        month: data.balance.month_xp,
        lifetime: data.balance.lifetime_xp,
      });
    }
  }, []);

  useEffect(() => {
    reloadXP();
  }, [reloadXP]);

  const awardXP = async (amount, eventType, meta = {}) => {
    await apiRequest("/api/xp/award", {
      method: "POST",
      body: JSON.stringify({ amount, event: eventType, meta }),
    });
    await reloadXP(); // auto refresh UI
  };

  return { xp, reloadXP, awardXP };
}

/* ───────────────────── 5) useStreak() ───────────────────── */

export function useStreak() {
  const [streak, setStreak] = useState(0);

  const loadStreak = useCallback(async () => {
    const data = await apiRequest("/api/progress/streak");
    if (data?.ok) setStreak(data.streak);
  }, []);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return { streak, reload: loadStreak };
}
