// Pure helpers shared by the customer chat and the admin inbox (no React, easy to unit test).
export const MAX_BODY = 2000;
export const PAGE_SIZE = 30;
export const STORE_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function newClientMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers.
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Server timestamps are UTC; values without an offset are treated as UTC too.
export function parseTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) || !text.includes("T") ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRole(value) {
  return String(value || "").toLowerCase() === "staff" ? "Staff" : "Customer";
}

export function normalizeProduct(raw, productId) {
  const source = raw && typeof raw === "object" ? raw : null;
  const id = source?.id ?? source?.productId ?? productId;
  if (id == null) return null;
  return { id, name: source?.name ?? source?.productName ?? "", price: source?.price ?? null,
    imageUrl: source?.imageUrl ?? source?.productImageUrl ?? null, isAvailable: source?.isAvailable ?? true };
}

export function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const productId = raw.productId ?? raw.product?.id ?? null;
  return {
    id: raw.id ?? null,
    conversationId: raw.conversationId ?? null,
    senderRole: normalizeRole(raw.senderRole ?? raw.side),
    senderName: raw.senderName ?? null,
    body: typeof raw.body === "string" ? raw.body : "",
    productId,
    product: productId != null || raw.product ? normalizeProduct(raw.product ?? (raw.productName ? raw : null), productId) : null,
    clientMessageId: raw.clientMessageId ? String(raw.clientMessageId).toLowerCase() : null,
    createdAt: raw.createdAt ?? null,
    status: "sent",
  };
}

// Accepts `[...]`, `{ messages }`, `{ items }`, plus optional conversation/hasMore metadata.
export function normalizePage(data, take = PAGE_SIZE) {
  const list = Array.isArray(data) ? data : data?.messages ?? data?.items ?? [];
  const messages = list.map(normalizeMessage).filter(Boolean);
  const conversation = Array.isArray(data) ? null : data?.conversation ?? null;
  const hasMore = typeof data?.hasMore === "boolean" ? data.hasMore : messages.length >= take;
  return { messages, hasMore, conversation };
}

const byOrder = (a, b) => {
  if (a.id != null && b.id != null) return a.id - b.id;
  if (a.id == null && b.id == null) return (a.localOrder ?? 0) - (b.localOrder ?? 0);
  return a.id == null ? 1 : -1; // unsent messages stay at the bottom
};

// Merge server messages into the list; a confirmed copy replaces its optimistic twin (same clientMessageId).
export function mergeMessages(list, incoming) {
  const result = [...list];
  for (const message of incoming) {
    if (!message) continue;
    const index = result.findIndex(item => (message.id != null && item.id === message.id) ||
      (message.clientMessageId && item.clientMessageId === message.clientMessageId));
    const product = message.product?.name ? message.product : result[index]?.product ?? message.product;
    if (index >= 0) result[index] = { ...result[index], ...message, product, status: "sent", error: "" };
    else result.push(message);
  }
  return result.sort(byOrder);
}

export function lastIdFrom(messages, role) {
  let last = 0;
  for (const message of messages) if (message.id != null && (!role || message.senderRole === role) && message.id > last) last = message.id;
  return last;
}

export function firstId(messages) {
  return messages.find(message => message.id != null)?.id ?? null;
}

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
export function dayKey(date) { return date ? dayKeyFormatter.format(date) : "pending"; }

export function dayLabel(date, now = new Date()) {
  if (!date) return "Hôm nay";
  const key = dayKey(date);
  if (key === dayKey(now)) return "Hôm nay";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday)) return "Hôm qua";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
    .replace(/^./, letter => letter.toUpperCase());
}

export function timeLabel(date) {
  return date ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "";
}

export function relativeTime(value, now = new Date()) {
  const date = parseTime(value);
  if (!date) return "";
  const seconds = Math.max(0, (now - date) / 1000);
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (dayKey(date) === dayKey(now)) return timeLabel(date);
  if (seconds < 7 * 86400) return dayLabel(date, now) === "Hôm qua" ? "Hôm qua"
    : new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date);
}

const GROUP_GAP_MS = 5 * 60 * 1000;
// Day sections -> runs of consecutive messages from the same side within 5 minutes.
export function groupMessages(messages, now = new Date()) {
  const days = [];
  for (const message of messages) {
    const date = parseTime(message.createdAt) ?? (message.id == null ? now : null);
    const key = dayKey(date);
    let day = days.at(-1);
    if (!day || day.key !== key) { day = { key, label: dayLabel(date, now), groups: [] }; days.push(day); }
    let group = day.groups.at(-1);
    const previous = group?.messages.at(-1);
    const previousDate = previous ? parseTime(previous.createdAt) ?? now : null;
    if (!group || group.senderRole !== message.senderRole || (date && previousDate && date - previousDate > GROUP_GAP_MS)) {
      group = { key: `${message.id ?? message.clientMessageId}`, senderRole: message.senderRole, messages: [] };
      day.groups.push(group);
    }
    group.messages.push({ ...message, date });
  }
  return days;
}

export function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words.at(-1)[0]).toUpperCase();
}

// The bubble is not shown on the contact page (it has the big panel), in admin, or to admins.
export function isWidgetHidden(pathname, isAdmin) {
  return Boolean(isAdmin) || pathname === "/lien-he" || pathname.startsWith("/lien-he/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function normalizeConversation(raw) {
  const customer = raw.customer ?? {};
  const last = raw.lastMessage ? normalizeMessage(raw.lastMessage) : null;
  return {
    id: raw.id ?? raw.conversationId,
    status: raw.status === "Closed" ? "Closed" : "Open",
    lastMessageAt: raw.lastMessageAt ?? last?.createdAt ?? raw.createdAt ?? null,
    unreadCount: Number(raw.unreadCount ?? raw.unread ?? 0) || 0,
    customerLastReadId: Number(raw.customerLastReadId ?? 0) || 0,
    staffLastReadId: Number(raw.staffLastReadId ?? 0) || 0,
    customer: {
      id: customer.id ?? raw.customerId ?? null,
      name: customer.fullName ?? customer.name ?? raw.customerName ?? "Khách hàng",
      email: customer.email ?? raw.customerEmail ?? "",
      phone: customer.phone ?? customer.phoneNumber ?? raw.customerPhone ?? "",
      orderCount: customer.orderCount ?? raw.orderCount ?? null,
      upcomingAppointmentCount: customer.upcomingAppointmentCount ?? raw.upcomingAppointmentCount ?? null,
    },
    lastMessage: last ?? (raw.lastMessageBody != null ? { body: raw.lastMessageBody, senderRole: raw.lastMessageSenderRole === "Staff" ? "Staff" : "Customer" } : null),
  };
}
