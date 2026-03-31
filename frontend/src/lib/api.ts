import axios from "axios";
import { clearAuth, getToken } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") {
        const authPage =
          window.location.pathname === "/login" ||
          window.location.pathname === "/register";
        if (!authPage) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);