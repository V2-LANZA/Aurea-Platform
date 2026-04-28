import axios from "axios";
import { clearAuth, getToken } from "./auth";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

function normalizeApiBase(rawBase?: string | null) {
  const candidate = rawBase?.trim() || DEFAULT_API_BASE;
  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    console.warn("Invalid API base URL, falling back to default", {
      rawBase,
      fallback: DEFAULT_API_BASE,
    });
    return DEFAULT_API_BASE;
  }
}

export const API_BASE = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || null
);

export function buildApiUrl(path: string) {
  try {
    return new URL(path, `${API_BASE}/`).toString();
  } catch {
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }
}

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

  const requestUrl =
    typeof config.url === "string" ? buildApiUrl(config.url) : undefined;
  if (typeof window !== "undefined") {
    (window as Window & { __AUREA_LAST_API_URL__?: string }).__AUREA_LAST_API_URL__ = requestUrl;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error?.config;
    const response = error?.response;
    const fullUrl =
      typeof config?.url === "string"
        ? /^https?:\/\//i.test(config.url)
          ? config.url
          : buildApiUrl(config.url)
        : undefined;
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      url: config?.url,
      baseURL: config?.baseURL || API_BASE,
      fullUrl,
      status: response?.status,
      data: response?.data,
      method: config?.method,
    };
    if (!error?.response) {
      console.warn("API network error", {
        ...errorDetails,
        lastApiUrl:
          typeof window !== "undefined"
            ? (window as Window & { __AUREA_LAST_API_URL__?: string }).__AUREA_LAST_API_URL__
            : undefined,
      });
    } else {
      console.warn("API response error", errorDetails);
    }
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
