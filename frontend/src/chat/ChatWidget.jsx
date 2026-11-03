import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useChat } from "./context";
import ChatPanel from "./ChatPanel";
import { isWidgetHidden } from "./chatModel";
import { ChatBubbleIcon, CloseIcon } from "./ChatIcons";

/** Floating chat bubble + panel (desktop 360×540, mobile full-screen sheet). */
export default function ChatWidget() {
  const chat = useChat();
  const { pathname } = useLocation();
  if (!chat || isWidgetHidden(pathname, chat.isAdmin)) return null;
  return <FloatingChat chat={chat} />;
}

function FloatingChat({ chat }) {
  const { unread, widgetOpen: open, setWidgetOpen } = chat;
  const launcher = useRef(null);
  const closeButton = useRef(null);
  const returnFocus = useRef(false);
  // The launcher is hidden behind the mobile sheet while open, so focus it after the panel has closed.
  useEffect(() => {
    if (!open && returnFocus.current) { returnFocus.current = false; launcher.current?.focus(); }
  }, [open]);
  const close = () => { returnFocus.current = true; setWidgetOpen(false); };
  const badge = unread > 9 ? "9+" : String(unread);
  const label = open ? "Đóng chat tư vấn" : unread > 0 ? `Mở chat tư vấn, ${unread} tin nhắn chưa đọc` : "Mở chat tư vấn";

  return <div className={`chat-widget${open ? " chat-widget--open" : ""}`}>
    {open && <div id="chat-widget-panel" className="chat-widget-panel" role="dialog" aria-modal="false" aria-label="Chat với tư vấn viên Gem Aurelia"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <ChatPanel variant="widget" onClose={close} autoFocus closeRef={closeButton} />
    </div>}
    <button ref={launcher} type="button" className="chat-launcher" aria-label={label} aria-expanded={open} aria-controls={open ? "chat-widget-panel" : undefined}
      onClick={() => open ? close() : setWidgetOpen(true)}>
      {open ? <CloseIcon size={24} /> : <ChatBubbleIcon />}
      {!open && unread > 0 && <span className="chat-launcher-badge" aria-hidden="true">{badge}</span>}
    </button>
  </div>;
}
