import axios from "axios";
import { logout } from "../auth/session";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:1111/api";

// Gốc backend, bỏ đuôi /api để ghép URL ảnh
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) logout();
    return Promise.reject(error);
  },
);

// Ảnh backend trả về dạng "/uploads/products/..."
export function resolveImageUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

export default api;
