import apiClient from "./apiClient";

/* =========================
   AUTH
========================= */
export function adminLogin(email, password) {
  return apiClient.post("/admin/auth/login", { email, password });
}

/* =========================
   DASHBOARD
========================= */
export function getAdminDashboard() {
  return apiClient.get("/admin/dashboard");
}

/* =========================
   LESSONS
========================= */
export function getLessons() {
  return apiClient.get("/admin/lessons");
}

export function createLesson(data) {
  return apiClient.post("/admin/lessons", data);
}

export function updateLesson(id, data) {
  return apiClient.put(`/admin/lessons/${id}`, data);
}

export function deleteLesson(id) {
  return apiClient.delete(`/admin/lessons/${id}`);
}

/* =========================
   QUIZZES
========================= */

// Admin — get all quizzes
export function getQuizzes() {
  return apiClient.get("/admin/quizzes");
}

// Admin — get quiz by ID
export function getQuiz(id) {
  return apiClient.get(`/admin/quizzes/${id}`);
}

// Admin — create new quiz
export function createQuiz(data) {
  return apiClient.post("/admin/quizzes", data);
}

// Admin — update quiz
export function updateQuiz(id, data) {
  return apiClient.put(`/admin/quizzes/${id}`, data);
}

// Admin — delete quiz
export function deleteQuiz(id) {
  return apiClient.delete(`/admin/quizzes/${id}`);
}

/* =========================
   USERS
========================= */

// list all users
export const getAllUsers = () => apiClient.get("/admin/users");

// single user
export const getUserById = (id) => apiClient.get(`/admin/users/${id}`);

// reset XP
export const resetUserXP = (id) =>
  apiClient.patch(`/admin/users/${id}/reset-xp`);

// reset streak
export const resetUserStreak = (id) =>
  apiClient.patch(`/admin/users/${id}/reset-streak`);

// ban / unban
export const toggleBanUser = (id) =>
  apiClient.patch(`/admin/users/${id}/toggle-ban`);

// hard delete user (if you want it)
export const deleteUser = (id) =>
  apiClient.delete(`/admin/users/${id}`);
