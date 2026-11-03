import { NavLink } from "react-router-dom";
import { useChat } from "./context";

/** "Tin nhắn" entry in the admin nav with the number of conversations waiting for a reply. */
export default function AdminChatNavLink() {
  const unread = useChat()?.unread ?? 0;
  return <NavLink to="/admin/chat" className="admin-nav-chat">Tin nhắn
    {unread > 0 && <span className="admin-nav-badge"><span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
      <span className="visually-hidden"> ({unread} hội thoại chưa đọc)</span></span>}</NavLink>;
}
