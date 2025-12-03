import axios from "axios";
import { API_BASE_URL } from "../config";

function adminAuthHeader() {
  const t = localStorage.getItem("adminToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- Admin Login ----
export function adminLogin(data) {
  return adminApi.post("/auth/login", data);
}

// ---- Dashboard ----
export function getAdminDashboard() {
  return adminApi.get("/dashboard", { headers: adminAuthHeader() });
}

// ---- Lessons ----
export function getAllLessons() {
  return adminApi.get("/lessons", { headers: adminAuthHeader() });
}

export function createLesson(data) {
  return adminApi.post("/lessons", data, {
    headers: adminAuthHeader(),
  });
}

// ---- Quizzes ----
export function getAllQuizzes() {
  return adminApi.get("/quizzes", { headers: adminAuthHeader() });
}

export function createQuiz(data) {
  return adminApi.post("/quizzes", data, {
    headers: adminAuthHeader(),
  });
}
import apiClient from "./apiClient";

// AUTH
export const adminLogin = (email, password) =>
  apiClient.post("/admin/auth/login", { email, password });

// DASHBOARD
export const getAdminDashboard = () => apiClient.get("/admin/dashboard");

// LESSONS
export const getLessons = () => apiClient.get("/admin/lessons");

export const createLesson = (data) => apiClient.post("/admin/lessons", data);

export const updateLesson = (id, data) =>
  apiClient.put(`/admin/lessons/${id}`, data);

export const deleteLesson = (id) => apiClient.delete(`/admin/lessons/${id}`);

// QUIZZES (for later)
export const getQuizzes = () => apiClient.get("/admin/quizzes");

export const createQuiz = (data) => apiClient.post("/admin/quizzes", data);
import apiClient from "./apiClient";

// ---------- AUTH ----------
export const adminLogin = (email, password) =>
  apiClient.post("/admin/auth/login", { email, password });

// ---------- DASHBOARD ----------
export const getAdminDashboard = () => apiClient.get("/admin/dashboard");

// ---------- LESSONS ----------
export const getLessons = () => apiClient.get("/admin/lessons");

export const createLesson = (data) => apiClient.post("/admin/lessons", data);

export const updateLesson = (id, data) =>
  apiClient.put(`/admin/lessons/${id}`, data);

export const deleteLesson = (id) => apiClient.delete(`/admin/lessons/${id}`);

// ---------- QUIZZES ----------
export const getQuizzes = () => apiClient.get("/admin/quizzes");

export const getQuiz = (id) => apiClient.get(`/admin/quizzes/${id}`);

export const createQuiz = (data) => apiClient.post("/admin/quizzes", data);

export const updateQuiz = (id, data) =>
  apiClient.put(`/admin/quizzes/${id}`, data);

export const deleteQuiz = (id) => apiClient.delete(`/admin/quizzes/${id}`);

export function getAllQuizzes(lessonId) {
  return adminApi.get(`/quizzes?lessonId=${lessonId}`);
}

export function deleteQuiz(id) {
  return adminApi.delete(`/quizzes/${id}`);
}

export function createQuiz(data) {
  return adminApi.post(`/quizzes`, data);
}
