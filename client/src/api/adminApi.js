// client/src/api/adminApi.js
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fluencyjet-sentence-master-production-de09.up.railway.app";

export const ADMIN_TOKEN_KEY = "fj_admin_token";

/**
 * Build headers for admin-protected endpoints
 */
function getAdminHeaders() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeError(error, fallbackMessage) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return fallbackMessage;
}

/* ─────────────────────────────────────────────
   ADMIN AUTH
   POST /api/admin/login
   Body: { email, password }
────────────────────────────────────────────── */

export async function loginAsAdmin(email, password) {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/admin/login`,
      { email, password },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    // Expecting { ok, token, user: {...} }
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Admin login failed");
    console.error("[adminApi] loginAsAdmin error:", error);
    throw new Error(message);
  }
}

/* ─────────────────────────────────────────────
   ADMIN DASHBOARD
   GET /api/admin/dashboard
────────────────────────────────────────────── */

export async function getAdminDashboard() {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/admin/dashboard`, {
      headers: getAdminHeaders(),
    });
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to load admin dashboard");
    console.error("[adminApi] getAdminDashboard error:", error);
    throw new Error(message);
  }
}

/* ─────────────────────────────────────────────
   LESSONS CRUD
   GET    /api/admin/lessons
   POST   /api/admin/lessons
   PUT   /api/admin/lessons/:id
   DELETE /api/admin/lessons/:id
────────────────────────────────────────────── */

export async function getLessons() {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/admin/lessons`, {
      headers: getAdminHeaders(),
    });
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to load lessons");
    console.error("[adminApi] getLessons error:", error);
    throw new Error(message);
  }
}

export async function createLesson(payload) {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/admin/lessons`, payload, {
      headers: getAdminHeaders(),
    });
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to create lesson");
    console.error("[adminApi] createLesson error:", error);
    throw new Error(message);
  }
}

export async function updateLesson(id, payload) {
  try {
    const res = await axios.put(
      `${API_BASE_URL}/api/admin/lessons/${id}`,
      payload,
      {
        headers: getAdminHeaders(),
      },
    );
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to update lesson");
    console.error("[adminApi] updateLesson error:", error);
    throw new Error(message);
  }
}

export async function deleteLesson(id) {
  try {
    const res = await axios.delete(`${API_BASE_URL}/api/admin/lessons/${id}`, {
      headers: getAdminHeaders(),
    });
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to delete lesson");
    console.error("[adminApi] deleteLesson error:", error);
    throw new Error(message);
  }
}

/* ─────────────────────────────────────────────
   QUIZZES
   (Lesson-scoped quizzes)
   GET    /api/admin/quizzes/:lessonId
   POST   /api/admin/quizzes/:lessonId
   DELETE /api/admin/quizzes/:lessonId/:questionId
────────────────────────────────────────────── */

export async function getQuizzes(lessonId) {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/admin/quizzes/${lessonId}`,
      {
        headers: getAdminHeaders(),
      },
    );
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to load quizzes");
    console.error("[adminApi] getQuizzes error:", error);
    throw new Error(message);
  }
}

export async function createQuiz(lessonId, payload) {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/admin/quizzes/${lessonId}`,
      payload,
      {
        headers: getAdminHeaders(),
      },
    );
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to create quiz");
    console.error("[adminApi] createQuiz error:", error);
    throw new Error(message);
  }
}

export async function deleteQuiz(lessonId, questionId) {
  try {
    const res = await axios.delete(
      `${API_BASE_URL}/api/admin/quizzes/${lessonId}/${questionId}`,
      {
        headers: getAdminHeaders(),
      },
    );
    return res.data;
  } catch (error) {
    const message = normalizeError(error, "Failed to delete quiz");
    console.error("[adminApi] deleteQuiz error:", error);
    throw new Error(message);
  }
}
