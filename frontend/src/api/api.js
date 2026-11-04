import axios from "axios";
import { getSessionToken, logout } from "../auth/session";
import { API_BASE_URL, API_ORIGIN } from "../config/apiBase";

export { API_ORIGIN };

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

// Ảnh backend trả về dạng "/uploads/products/..." hoặc "/catalog-gems/..."
export function resolveImageUrl(url) {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default api;
