// client/src/api/adminApi.js
// Centralized Admin API client – keeps existing endpoints & workflows intact

import axios from "axios";

/**
 * BACKEND BASE URL
 * - We always talk directly to the backend service, NOT the frontend URL.
 * - If VITE_BACKEND_URL is set, we use that.
 * - Otherwise we fall back to the production backend Railway URL.
 *
 * Examples:
 *   VITE_BACKEND_URL = "http://localhost:8080"
 *   VITE_BACKEND_URL = "https://fluencyjet-sentence-master-production.up.railway.app"
 */
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://fluencyjet-sentence-master-production.up.railway.app";

/**
 * All admin routes in the backend are under /api/admin/...
 */
const ADMIN_API_BASE = `${API_BASE_URL}/api/admin`;

/**
 * Small helper to include cookies (admin auth token) on every request.
 */
const withCreds = {
  withCredentials: true,
};

/* ───────────────────────────────
   ADMIN AUTH
   - Admin login / logout
   - Get current admin profile
   ─────────────────────────────── */

export async function loginAdmin(email, password) {
  try {
    const res = await axios.post(
      `${ADMIN_API_BASE}/login`,
      { email, password },
      withCreds,
    );

    // Backend returns { admin, token? } – we just forward the data
    return res.data;
  } catch (err) {
    console.error("Admin login failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Admin login failed. Please check your credentials.";
    throw new Error(message);
  }
}

export async function logoutAdmin() {
  try {
    const res = await axios.post(`${ADMIN_API_BASE}/logout`, null, withCreds);
    return res.data;
  } catch (err) {
    console.error("Admin logout failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Admin logout failed.";
    throw new Error(message);
  }
}

export async function getAdminProfile() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/me`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Fetch admin profile failed:", err?.response || err);
    const status = err?.response?.status;

    if (status === 401 || status === 403) {
      throw new Error("Not authorized. Please log in as admin.");
    }

    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch admin profile.";
    throw new Error(message);
  }
}

/* ───────────────────────────────
   ADMIN DASHBOARD / ANALYTICS
   ─────────────────────────────── */

export async function fetchDashboardStats() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/dashboard`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Fetch dashboard stats failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to load dashboard stats.";
    throw new Error(message);
  }
}

/* ───────────────────────────────
   LESSON MANAGEMENT
   ─────────────────────────────── */

export async function fetchLessons() {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/lessons`, withCreds);
    return res.data;
  } catch (err) {
    console.error("Fetch lessons failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch lessons.";
    throw new Error(message);
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to create lesson.";
    throw new Error(message);
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to update lesson.";
    throw new Error(message);
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to delete lesson.";
    throw new Error(message);
  }
}

/* ───────────────────────────────
   QUIZZES / XP / LEADERBOARD ANALYTICS
   (keep same endpoints as before)
   ─────────────────────────────── */

export async function fetchQuizAnalytics(params = {}) {
  try {
    const res = await axios.get(`${ADMIN_API_BASE}/analytics/quizzes`, {
      ...withCreds,
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Fetch quiz analytics failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch quiz analytics.";
    throw new Error(message);
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
    console.error("Fetch XP events failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch XP events.";
    throw new Error(message);
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
    console.error("Fetch leaderboard snapshot failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch leaderboard snapshot.";
    throw new Error(message);
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch students.";
    throw new Error(message);
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to fetch student detail.";
    throw new Error(message);
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
    console.error("Reset student progress failed:", err?.response || err);
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to reset student progress.";
    throw new Error(message);
  }
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
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to delete student.";
    throw new Error(message);
  }
}
