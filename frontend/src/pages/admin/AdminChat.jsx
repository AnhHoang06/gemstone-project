import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/api";
import { apiError, getSessionToken } from "../../auth/session";
import { connectionLabels, useChat } from "../../chat/context";
import { PAGE_SIZE, initials, normalizeConversation, normalizePage, relativeTime } from "../../chat/chatModel";
import { useNow, usePageVisible } from "../../chat/hooks";
import useChatThread from "../../chat/useChatThread";
import MessageThread from "../../chat/MessageThread";
import ChatComposer from "../../chat/ChatComposer";
import { BackIcon, SearchIcon } from "../../chat/ChatIcons";

const FILTERS = [["Open", "Đang mở"], ["Closed", "Đã đóng"], ["", "Tất cả"]];

export default function AdminChat() {
  const chat = useChat();
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get("c")) || null;
  const [status, setStatus] = useState("Open");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState({ items: [], loading: true, error: "" });
  const [selectedInfo, setSelectedInfo] = useState(null);
  const sequence = useRef(0);
  const now = useNow();
  const subscribe = chat?.subscribe;

  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);

  const loadList = useCallback(async () => {
    const number = ++sequence.current;
    const token = getSessionToken();
    try {
      const { data } = await api.get(`/admin/chat/conversations?status=${encodeURIComponent(status)}&q=${encodeURIComponent(search)}&take=50`);
      if (number !== sequence.current || token !== getSessionToken()) return;
      const items = (Array.isArray(data) ? data : data?.items ?? []).map(normalizeConversation);
      setList({ items, loading: false, error: "" });
    } catch (error) {
      if (number === sequence.current && error?.name !== "CanceledError")
        setList(value => ({ ...value, loading: false, error: apiError(error, "Không tải được danh sách hội thoại.") }));
    }
  }, [status, search]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => () => { ++sequence.current; }, []);

  // Any message/read event can reorder the inbox or change unread badges.
  useEffect(() => subscribe?.(event => { if (event.type !== "typing") void loadList(); }), [subscribe, loadList]);

  const listed = list.items.find(item => item.id === selectedId);
  const selected = listed ?? (selectedInfo?.id === selectedId ? selectedInfo : null);
  const select = conversation => { setSelectedInfo(conversation); setParams(conversation ? { c: String(conversation.id) } : {}); };

  return <main className="admin-page admin-chat-page">
    <div className="admin-page-heading"><h1>Tin nhắn</h1>
      <p className="admin-chat-connection" role="status"><i className={`chat-status-dot chat-status-dot--${chat?.connectionState ?? "offline"}`} aria-hidden="true" />
        {chat?.connectionState === "connected" ? "Đang nhận tin trực tiếp" : connectionLabels[chat?.connectionState ?? "offline"]}</p></div>
    <div className={`admin-chat${selectedId ? " admin-chat--selected" : ""}`}>
      <aside className="admin-chat-list" aria-label="Danh sách hội thoại">
        <div className="admin-chat-search"><SearchIcon />
          <label className="visually-hidden" htmlFor="admin-chat-search">Tìm theo tên hoặc email</label>
          <input id="admin-chat-search" type="search" value={query} placeholder="Tìm theo tên hoặc email" onChange={event => setQuery(event.target.value)} /></div>
        <div className="admin-chat-filters" role="group" aria-label="Lọc hội thoại">
          {FILTERS.map(([key, label]) => <button key={key || "all"} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>)}
        </div>
        {list.error && <p className="chat-error" role="alert">{list.error} <button type="button" onClick={() => void loadList()}>Thử lại</button></p>}
        {list.loading ? <p className="admin-chat-empty" role="status">Đang tải hội thoại…</p>
          : list.items.length === 0 ? <p className="admin-chat-empty">{search ? "Không tìm thấy hội thoại phù hợp." : status === "Closed" ? "Chưa có hội thoại đã đóng." : "Chưa có tin nhắn nào từ khách hàng."}</p>
          : <ul className="admin-chat-items">{list.items.map(item => <li key={item.id}>
            <button type="button" className={`admin-chat-item${item.unreadCount ? " is-unread" : ""}`} aria-current={item.id === selectedId ? "true" : undefined}
              onClick={() => select(item)}>
              <span className="chat-avatar chat-avatar--customer" aria-hidden="true">{initials(item.customer.name)}</span>
              <span className="admin-chat-item-main">
                <span className="admin-chat-item-top"><span className="admin-chat-item-name">{item.customer.name}</span>
                  <time dateTime={item.lastMessageAt ?? undefined}>{relativeTime(item.lastMessageAt, now)}</time></span>
                <span className="admin-chat-item-bottom"><span className="admin-chat-item-preview">
                  {item.lastMessage ? `${item.lastMessage.senderRole === "Staff" ? "Bạn: " : ""}${item.lastMessage.body || (item.lastMessage.productId ? "Đã gửi một sản phẩm" : "")}` : item.customer.email}</span>
                  {item.status === "Closed" && <span className="admin-chat-closed-tag">Đã đóng</span>}
                  {item.unreadCount > 0 && <span className="admin-chat-unread"><span aria-hidden="true">{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>
                    <span className="visually-hidden">{item.unreadCount} tin chưa đọc</span></span>}</span>
              </span>
            </button></li>)}</ul>}
      </aside>
      <section className="admin-chat-pane" aria-label="Nội dung hội thoại">
        {selectedId ? <ConversationPane key={selectedId} id={selectedId} info={selected} onBack={() => select(null)} onChanged={loadList} />
          : <div className="admin-chat-placeholder"><p>Chọn một hội thoại để xem và trả lời tin nhắn.</p></div>}
      </section>
    </div>
  </main>;
}

function ConversationPane({ id, info, onBack, onChanged }) {
  const chat = useChat();
  const inputId = useId().replace(/:/g, "");
  const visible = usePageVisible();
  const [conversation, setConversation] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
  const subscribe = chat?.subscribe, refreshUnread = chat?.refreshUnread;
  const base = `/admin/chat/conversations/${id}`;
  const thread = useChatThread({
    enabled: true,
    mySide: "Staff",
    autoRead: visible,
    loadPage: async before => {
      const { data } = await api.get(`${base}/messages?take=${PAGE_SIZE}${before != null ? `&before=${before}` : ""}`);
      const page = normalizePage(data);
      if (page.conversation) setConversation(normalizeConversation({ id, ...page.conversation }));
      return { ...page, otherLastReadId: page.conversation?.customerLastReadId ?? info?.customerLastReadId ?? 0,
        myLastReadId: page.conversation?.staffLastReadId ?? 0 };
    },
    postMessage: async payload => (await api.post(`${base}/messages`, payload)).data,
    markRead: async lastMessageId => { await api.post(`${base}/read`, { lastMessageId }); void refreshUnread?.(); void onChanged(); },
  });
  const { receive, setOtherRead, showTyping, reload } = thread;

  useEffect(() => subscribe?.(event => {
    if (event.type === "connected") { void reload(); return; }
    if (Number(event.conversationId) !== id) return;
    if (event.type === "message") receive(event.message);
    else if (event.type === "read" && String(event.side).toLowerCase() === "customer") setOtherRead(event.lastReadId);
    else if (event.type === "typing" && String(event.side ?? "").toLowerCase() !== "staff") showTyping();
    else if (event.type === "conversation" && event.status) setConversation(value => ({ ...(value ?? {}), id, status: event.status }));
  }), [subscribe, id, receive, setOtherRead, showTyping, reload]);

  const current = conversation ? { ...info, ...conversation, customer: { ...info?.customer, ...pick(conversation.customer) } } : info;
  const customer = current?.customer ?? { name: "Khách hàng" };
  const closed = current?.status === "Closed";

  async function toggleStatus() {
    const next = closed ? "Open" : "Closed";
    setStatusBusy(true); setStatusError("");
    try {
      await api.put(`${base}/status`, { status: next });
      setConversation(value => ({ ...(value ?? current), status: next }));
      void onChanged();
    } catch (error) {
      setStatusError(apiError(error, "Không cập nhật được trạng thái hội thoại."));
    } finally { setStatusBusy(false); }
  }

  return <div className="admin-conversation">
    <header className="admin-conversation-header">
      <button type="button" className="chat-icon-button admin-chat-back" aria-label="Quay lại danh sách" onClick={onBack}><BackIcon /></button>
      <span className="chat-avatar chat-avatar--customer" aria-hidden="true">{initials(customer.name)}</span>
      <div className="admin-conversation-title"><h2>{customer.name}</h2>
        <p>{closed ? "Hội thoại đã đóng" : "Đang mở"}</p></div>
      <button type="button" className="chat-btn chat-btn--ghost" onClick={() => void toggleStatus()} disabled={statusBusy}>
        {statusBusy ? "Đang lưu…" : closed ? "Mở lại hội thoại" : "Đóng hội thoại"}</button>
    </header>
    <dl className="admin-customer-card" aria-label="Thông tin khách hàng">
      {customer.email && <div><dt>Email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>}
      <div><dt>Điện thoại</dt><dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : "Chưa có"}</dd></div>
      {customer.orderCount != null && <div><dt>Đơn hàng</dt><dd>{customer.orderCount}</dd></div>}
      <div><dt>Lịch hẹn</dt><dd>{customer.upcomingAppointmentCount != null && `${customer.upcomingAppointmentCount} sắp tới · `}
        <Link to={`/admin/appointments${customer.email ? `?q=${encodeURIComponent(customer.email)}` : ""}`}>Xem lịch hẹn của khách</Link></dd></div>
    </dl>
    {statusError && <p className="chat-error" role="alert">{statusError}</p>}
    {thread.error && <p className="chat-error" role="alert">{thread.error} <button type="button" onClick={() => void thread.reload()}>Thử lại</button></p>}
    {!thread.loaded && !thread.error && <p className="chat-loading" role="status">Đang tải tin nhắn…</p>}
    <MessageThread thread={thread} mySide="Staff" otherName={customer.name} otherAvatarName={customer.name}
      label={`Tin nhắn với ${customer.name}`} externalProducts onRetry={thread.retry} onDiscard={thread.discard}
      empty={<p className="admin-chat-empty">Chưa có tin nhắn.</p>} />
    {closed && <p className="admin-chat-closed-note">Hội thoại đã đóng. Khách nhắn tin mới sẽ tự mở lại; bạn vẫn có thể trả lời.</p>}
    <ChatComposer id={`${inputId}-reply`} label={`Trả lời ${customer.name}`} placeholder="Nhập câu trả lời…"
      onSend={body => { thread.send(body); return true; }} onTyping={() => chat?.sendTyping(id)} />
  </div>;
}

function pick(object) {
  return Object.fromEntries(Object.entries(object ?? {}).filter(([key, value]) => value !== null && value !== "" && !(key === "name" && value === "Khách hàng")));
}
