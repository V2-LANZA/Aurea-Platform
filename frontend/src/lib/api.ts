import axios from "axios";
import { getToken } from "./auth";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  config.headers = config.headers ?? {};

  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  } else {
    delete (config.headers as any).Authorization;
  }

  // ✅ debug (you can remove later)
  console.log("[API]", config.method?.toUpperCase(), config.url, {
    Authorization: (config.headers as any).Authorization,
  });

  return config;
});