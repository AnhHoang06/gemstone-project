import { createContext, useContext } from "react";

export const ChatContext = createContext(null);
export function useChat() { return useContext(ChatContext); }

// Connection codes -> short Vietnamese labels for the panel header.
export const connectionLabels = {
  offline: "Chưa đăng nhập",
  connecting: "Đang kết nối…",
  connected: "Đã kết nối · trả lời trong giờ làm việc",
  reconnecting: "Đang kết nối lại…",
  disconnected: "Mất kết nối, đang thử lại",
};
