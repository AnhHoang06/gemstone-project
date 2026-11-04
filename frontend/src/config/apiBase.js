// Gốc backend lấy từ VITE_API_BASE_URL (đặt trên Vercel cho production, .env.local khi dev).
// Chấp nhận cả dạng có đuôi /api (cách cấu hình cũ) lẫn không có.
export const DEV_API_ORIGIN = "http://localhost:5113";

export function normalizeApiOrigin(raw, fallback = "") {
  const value = (raw ?? "").trim() || fallback;
  return value.replace(/\/+$/, "").replace(/\/api$/i, "");
}

// Chỉ dev mới dùng localhost; bản build production loại bỏ hẳn giá trị dự phòng này.
export const API_ORIGIN = normalizeApiOrigin(import.meta.env.VITE_API_BASE_URL, import.meta.env.DEV ? DEV_API_ORIGIN : "");
export const API_BASE_URL = `${API_ORIGIN}/api`;

if (!API_ORIGIN && import.meta.env.PROD) {
  // Build production thiếu biến: gọi cùng domain thay vì âm thầm gọi localhost.
  console.error("VITE_API_BASE_URL chưa được cấu hình cho bản build này.");
}
