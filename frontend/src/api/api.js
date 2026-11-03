import axios from "axios";
import { getSessionToken, logout } from "../auth/session";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:1111/api";

// Gốc backend, bỏ đuôi /api để ghép URL ảnh
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getSessionToken();
  config.sessionToken = token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.sessionToken !== getSessionToken())
      throw new axios.CanceledError("Session changed");
    return response;
  },
  (error) => {
    if (error.config && error.config.sessionToken !== getSessionToken())
      return Promise.reject(new axios.CanceledError("Session changed"));
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
