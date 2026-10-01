import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:1111/api";

// Gốc của backend (bỏ đuôi /api) — dùng để ghép URL ảnh upload
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Ảnh trả về từ backend (ImageUrl) là đường dẫn tương đối kiểu "/uploads/products/5/abc.png".
// Dùng hàm này để ghép thành URL đầy đủ tới backend khi hiển thị <img src=... />.
export function resolveImageUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

export default api;
