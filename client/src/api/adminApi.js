// client/src/api/adminApi.js
// Centralized Admin API client – clean & stable version

import axios from "axios";

/**
 * BACKEND BASE URL
 * Priority:
 * 1. VITE_BACKEND_URL (local dev)
 * 2. Production backend on Railway
 */
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://fluencyjet-sentence-master-production.up.railway.app";

/** All admin endpoints live under /api/admin */
const ADMIN_API_BASE = `${API_BASE_URL}/api/admin`;

/** Always send cookies (admin auth) */
const withCreds = {
  withCredentials: true,
};

/* ───────────────────────────────
   ADMIN AUTH (LOGIN / LOGOUT / PROFILE)
   ─────────────────────────────── */

export async function loginAdmin(email, password) {
  try {
    const res = await axios.post(
      `${ADMIN_API_BASE}/login`,
      { email, password },
      withCreds,
    );
    return res.data; // { admin, token? }
  } catch (err) {
    console.error("Admin login failed:", err?.response || err);
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Admin login failed.";
    throw new Error(msg);
  }
}

export async function logoutAdmin() {
  try {
    const res = await axios.post(`${ADMIN_API_BASE}/logout`, null, withCreds);
    return res.data;
  } catch (err) {
    console.error("Admin logout failed:", err?.response || err);
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Admin logout failed.";
    throw new Error(msg);
  }
}

export async function getAdminProfile() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/me`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Fetch admin profile failed:", err?.response || err);

    if (err?.response?.status === 401 || err?.response?.status === 403) {
      throw new Error("Not authorized. Please log in as admin.");
    }

    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch admin profile.";
    throw new Error(msg);
  }
}

/* ───────────────────────────────
   DASHBOARD ANALYTICS
   ─────────────────────────────── */

export async function fetchDashboardStats() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/dashboard`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Dashboard stats failed:", err?.response || err);
    throw new Error("Failed to load dashboard stats.");
  }
}

/* ───────────────────────────────
   LESSONS
   ─────────────────────────────── */

export async function fetchLessons() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/lessons`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Fetch lessons failed:", err?.response || err);
    throw new Error("Failed to fetch lessons.");
  }
}

export async function createLesson(payload) {
  try {
    const res = await axios.post(
      `${ADMIN_API_BASE}/lessons`,
      payload,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Create lesson failed:", err?.response || err);
    throw new Error("Failed to create lesson.");
  }
}

export async function updateLesson(id, payload) {
  try {
    const res = await axios.put(
      `${ADMIN_API_BASE}/lessons/${id}`,
      payload,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Update lesson failed:", err?.response || err);
    throw new Error("Failed to update lesson.");
  }
}

export async function deleteLesson(id) {
  try {
    const res = await axios.delete(
      `${ADMIN_API_BASE}/lessons/${id}`,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Delete lesson failed:", err?.response || err);
    throw new Error("Failed to delete lesson.");
  }
}

/* ───────────────────────────────
   QUIZZES / XP / LEADERBOARD ANALYTICS
   ─────────────────────────────── */

export async function fetchQuizAnalytics(params = {}) {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/analytics/quizzes`, {
      ...withCreds,
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Quiz analytics failed:", err?.response || err);
    throw new Error("Failed to fetch quiz analytics.");
  }
}

export async function fetchXpEvents(params = {}) {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/analytics/xp-events`, {
      ...withCreds,
      params,
    });
    return res.data;
  } catch (err) {
    console.error("XP events failed:", err?.response || err);
    throw new Error("Failed to fetch XP events.");
  }
}

export async function fetchLeaderboardSnapshot(params = {}) {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/analytics/leaderboard`, {
      ...withCreds,
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Leaderboard snapshot failed:", err?.response || err);
    throw new Error("Failed to fetch leaderboard snapshot.");
  }
}

/* ───────────────────────────────
   USERS / STUDENTS
   ─────────────────────────────── */

export async function fetchStudents(params = {}) {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/students`, {
      ...withCreds,
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Fetch students failed:", err?.response || err);
    throw new Error("Failed to fetch students.");
  }
}

export async function fetchStudentDetail(studentId) {
  try {
    const res = await axios.get(
      `${ADMIN_API_BASE}/students/${studentId}`,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Fetch student detail failed:", err?.response || err);
    throw new Error("Failed to fetch student detail.");
  }
}

export async function resetStudentProgress(studentId) {
  try {
    const res = await axios.post(
      `${ADMIN_API_BASE}/students/${studentId}/reset-progress`,
      null,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Reset progress failed:", err?.response || err);
    throw new Error("Failed to reset student progress.");
  }
}
export async function adminLogin(email, password) {
  const res = await api.post("/auth/admin/login", { email, password });
  return res.data;
}

export async function deleteStudent(studentId) {
  try {
    const res = await axios.delete(
      `${ADMIN_API_BASE}/students/${studentId}`,
      withCreds,
    );
    return res.data;
  } catch (err) {
    console.error("Delete student failed:", err?.response || err);
    throw new Error("Failed to delete student.");
  }
}
