import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { connectionLabels, useChat } from "./context";
import MessageThread from "./MessageThread";
import ChatComposer from "./ChatComposer";
import { BrandMark, CloseIcon, GemIcon } from "./ChatIcons";

const QUICK_REPLIES = [
  { label: "Tư vấn chọn đá", body: "Tôi cần tư vấn chọn đá quý." },
  { label: "Kiểm định đá quý", body: "Tôi muốn kiểm định đá quý." },
  { label: "Đặt lịch tại showroom", to: "/hen-lich" },
  { label: "Tình trạng đơn hàng", body: "Tôi muốn hỏi về tình trạng đơn hàng." },
];
const PRODUCT_QUESTION = "Tôi muốn hỏi về sản phẩm này.";
const STAFF_NAME = "Tư vấn viên";

function Greeting({ name }) {
  return <div className="chat-group chat-group--other chat-greeting">
    <span className="chat-avatar chat-avatar--staff" aria-hidden="true"><BrandMark size={18} /></span>
    <div className="chat-group-body"><p className="chat-sender">Gem Aurelia</p>
      <p className="chat-bubble">Xin chào{name ? ` ${name}` : ""}! Gem Aurelia có thể giúp gì cho bạn? Hãy để lại câu hỏi, tư vấn viên sẽ trả lời bạn trong giờ làm việc.</p></div>
  </div>;
}

/**
 * Customer chat panel shared by the floating widget and the /lien-he page.
 * variant: "widget" (header with close button) | "page".
 */
export default function ChatPanel({ variant = "page", onClose, autoFocus = false, closeRef }) {
  const chat = useChat();
  const { pathname, search } = useLocation();
  const baseId = useId().replace(/:/g, "");
  const titleId = `${baseId}-title`;
  const inputRef = useRef(null);
  const [attached, setAttached] = useState(null);
  const status = chat?.connectionState ?? "offline";
  const product = chat?.productContext;
  const attachment = attached && product && attached === product.id ? product : null;
  const thread = chat?.thread;
  const registerViewer = chat?.registerViewer;
  const isCustomer = Boolean(chat?.isCustomer);

  useEffect(() => {
    if (!isCustomer || !registerViewer) return;
    return registerViewer();
  }, [isCustomer, registerViewer]);

  useEffect(() => {
    if (!autoFocus) return;
    const target = inputRef.current ?? closeRef?.current;
    target?.focus({ preventScroll: true });
  }, [autoFocus, closeRef]);

  const next = encodeURIComponent(variant === "page" ? "/lien-he" : `${pathname}${search}`);
  const name = isCustomer ? (localStorage.getItem("fullName") || "").trim().split(/\s+/).at(-1) : "";
  const hasMessages = Boolean(thread?.messages.length);

  function send(body, extra) {
    if (!thread) return false;
    // extra === null: explicitly no attachment (quick replies).
    const productExtra = extra !== undefined ? extra : attachment ? { productId: attachment.id, product: attachment } : null;
    thread.send(body, productExtra ?? undefined);
    if (productExtra?.productId != null) setAttached(null);
    return true;
  }

  return <section className={`chat-panel chat-panel--${variant}`} aria-labelledby={titleId}>
    <header className="chat-panel-header">
      <span className="chat-panel-avatar" aria-hidden="true"><BrandMark size={24} /><i className={`chat-status-dot chat-status-dot--${status}`} /></span>
      <div className="chat-panel-heading">
        <h2 id={titleId}>Gem Aurelia · {STAFF_NAME}</h2>
        <p className="chat-panel-status">{isCustomer ? connectionLabels[status] : chat?.isAdmin ? "Tài khoản quản trị" : "Đăng nhập để trò chuyện"}</p>
      </div>
      {onClose && <button ref={closeRef} type="button" className="chat-icon-button chat-close" aria-label="Đóng khung chat" onClick={onClose}><CloseIcon /></button>}
    </header>

    {!chat?.token ? <div className="chat-guest">
      <div className="chat-scroller"><div className="chat-log"><Greeting /></div></div>
      <div className="chat-guest-card">
        <p><strong>Đăng nhập để trò chuyện với tư vấn viên.</strong> Tin nhắn được lưu trong tài khoản để bạn xem lại bất cứ lúc nào.</p>
        <div className="chat-guest-actions">
          <Link className="chat-btn chat-btn--primary" to={`/login?next=${next}`}>Đăng nhập</Link>
          <Link className="chat-btn chat-btn--ghost" to={`/register?next=${next}`}>Đăng ký</Link>
        </div>
      </div>
    </div> : chat.isAdmin ? <div className="chat-guest">
      <div className="chat-guest-card">
        <p><strong>Bạn đang dùng tài khoản quản trị.</strong> Trả lời khách hàng trong hộp thư quản trị.</p>
        <div className="chat-guest-actions"><Link className="chat-btn chat-btn--primary" to="/admin/chat">Mở hộp thư</Link></div>
      </div>
    </div> : <>
      {thread.error && <p className="chat-error" role="alert">{thread.error}
        <button type="button" onClick={() => void thread.reload()}>Thử lại</button></p>}
      {!thread.loaded && !thread.error && <p className="chat-loading" role="status">Đang tải tin nhắn…</p>}
      <MessageThread thread={thread} mySide="Customer" otherName={STAFF_NAME} label="Tin nhắn với tư vấn viên"
        intro={<Greeting name={name} />} onRetry={thread.retry} onDiscard={thread.discard} />
      <ChatComposer id={`${baseId}-input`} inputRef={inputRef} onSend={body => send(body)}
        onTyping={() => chat.sendTyping(thread.conversation?.id ?? thread.messages.find(item => item.conversationId)?.conversationId)}
        attachment={attachment} onRemoveAttachment={() => setAttached(null)} defaultBodyWithAttachment={PRODUCT_QUESTION}
        placeholder={attachment ? "Bạn muốn hỏi gì về sản phẩm này?" : "Nhập tin nhắn…"}>
        {(!hasMessages || (product && !attachment)) && <div className="chat-chips" role="group" aria-label="Gợi ý nhanh">
          {product && !attachment && <button type="button" className="chat-chip chat-chip--product" onClick={() => { setAttached(product.id); inputRef.current?.focus(); }}>
            <GemIcon size={15} /> Hỏi về sản phẩm này</button>}
          {!hasMessages && QUICK_REPLIES.map(reply => reply.to
            ? <Link key={reply.label} className="chat-chip" to={reply.to} onClick={() => chat.setWidgetOpen(false)}>{reply.label}</Link>
            : <button key={reply.label} type="button" className="chat-chip" onClick={() => send(reply.body, null)}>{reply.label}</button>)}
        </div>}
      </ChatComposer>
    </>}
  </section>;
}
