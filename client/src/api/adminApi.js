import apiClient from "./apiClient";

// =========================
// AUTH
// =========================
export function adminLogin(email, password) {
  return apiClient.post("/admin/auth/login", { email, password });
}

// =========================
// DASHBOARD
// =========================
export function getAdminDashboard() {
  return apiClient.get("/admin/dashboard");
}

// =========================
// LESSONS
// =========================
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
// ----------------------
// QUIZ ENDPOINTS
// ----------------------

// Get all quizzes for a lesson
export const getAllQuizzes = (lessonId) =>
  apiClient.get(`/admin/quizzes/all?lessonId=${lessonId}`);

// Create a new quiz
export const createQuiz = (data) =>
  apiClient.post("/admin/quizzes/create", data);

// Delete quiz by id
export const deleteQuiz = (id) =>
  apiClient.delete(`/admin/quizzes/delete/${id}`);

// =========================
// QUIZZES
// =========================
export function getQuizzes() {
  return apiClient.get("/admin/quizzes");
}

export function getQuiz(id) {
  return apiClient.get(`/admin/quizzes/${id}`);
}

export function createQuiz(data) {
  return apiClient.post(`/admin/quizzes`, data);
}

export function updateQuiz(id, data) {
  return apiClient.put(`/admin/quizzes/${id}`, data);
}

export function deleteQuiz(id) {
  return apiClient.delete(`/admin/quizzes/${id}`);
}
