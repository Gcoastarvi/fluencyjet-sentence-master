// client/src/api.js
import axios from "axios";
import { API_BASE_URL } from "./config";

// Auth APIs
export const signupUser = (data) =>
  axios.post(`${API_BASE_URL}/api/auth/signup`, data);

export const loginUser = (data) =>
  axios.post(`${API_BASE_URL}/api/auth/login`, data);

export const getUserProfile = (token) =>
  axios.get(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Progress APIs
export const getProgress = (userId) =>
  axios.get(`${API_BASE_URL}/api/progress/${userId}`);

export const updateProgress = (userId, data) =>
  axios.post(`${API_BASE_URL}/api/progress/${userId}`, data);

// Leaderboard APIs
export const getLeaderboard = () =>
  axios.get(`${API_BASE_URL}/api/leaderboard`);

// XP APIs
export const addXP = (userId, data) =>
  axios.post(`${API_BASE_URL}/api/xp/${userId}`, data);
