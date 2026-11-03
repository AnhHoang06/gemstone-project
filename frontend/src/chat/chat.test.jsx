import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), connections: [], nextId: 1000 }));
vi.mock("../api/api", () => ({
  default: { get: mocks.get, post: mocks.post, put: mocks.put },
  API_ORIGIN: "http://localhost:5113", resolveImageUrl: value => value,
}));
vi.mock("@microsoft/signalr", () => ({
  LogLevel: { None: 6 },
  HubConnectionBuilder: class {
    withUrl(url) { this.url = url; return this; } withAutomaticReconnect() { return this; } configureLogging() { return this; }
    build() {
      const handlers = {};
      const connection = {
        url: this.url, handlers,
        on: (name, fn) => { handlers[name] = fn; },
        onreconnecting: fn => { handlers.reconnecting = fn; },
        onreconnected: fn => { handlers.reconnected = fn; },
        onclose: fn => { handlers.close = fn; },
        start: vi.fn(() => Promise.resolve()),
        stop: vi.fn(() => Promise.resolve()),
        invoke: vi.fn(() => Promise.resolve()),
      };
      mocks.connections.push(connection); return connection;
    }
  },
}));

import ChatProvider from "./ChatProvider";
import ChatWidget from "./ChatWidget";
import ChatPanel from "./ChatPanel";
import ChatProductContext from "./ChatProductContext";
import AdminChatNavLink from "./AdminChatNavLink";
import Contact from "../pages/Contact";
import AdminChat from "../pages/admin/AdminChat";
import { saveSession } from "../auth/session";
import { groupMessages, mergeMessages, normalizeMessage } from "./chatModel";

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const staffMessage = (id, body, extra = {}) => ({ id, conversationId: 7, senderRole: "Staff", body, createdAt: iso(1), clientMessageId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, ...extra });
const customerMessage = (id, body, extra = {}) => ({ ...staffMessage(id, body), senderRole: "Customer", ...extra });
let chatPage, unreadCount, conversations, adminMessages;

function routeGet(path) {
  if (path.startsWith("/chat/unread")) return Promise.resolve({ data: { count: unreadCount } });
  if (path.startsWith("/chat/me")) return Promise.resolve({ data: chatPage });
  if (path.startsWith("/consultation/hours")) return Promise.resolve({ data: { days: [
    ...[1, 2, 3, 4, 5, 6].map(day => ({ dayOfWeek: day, isOpen: true, openTime: "09:00:00", closeTime: "18:00:00" })),
    { dayOfWeek: 0, isOpen: true, openTime: "09:00:00", closeTime: "12:00:00" }], closedDates: [{ date: "2099-01-01", reason: "Tết Dương lịch" }] } });
  if (path.startsWith("/admin/chat/conversations?")) return Promise.resolve({ data: conversations });
  if (/^\/admin\/chat\/conversations\/\d+\/messages/.test(path)) return Promise.resolve({ data: adminMessages });
  return Promise.resolve({ data: [] });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); mocks.connections.length = 0;
  for (const fn of [mocks.get, mocks.post, mocks.put]) fn.mockReset();
  chatPage = { conversation: { id: 7, status: "Open", staffLastReadId: 0, customerLastReadId: 0 }, messages: [], hasMore: false };
  mocks.nextId = 1000; unreadCount = 0; conversations = []; adminMessages = { messages: [], hasMore: false };
  mocks.get.mockImplementation(routeGet);
  mocks.post.mockImplementation((path, body) => path.endsWith("/messages")
    ? Promise.resolve({ data: { ...body, id: ++mocks.nextId, conversationId: 7, senderRole: path.startsWith("/admin") ? "Staff" : "Customer", createdAt: iso() } })
    : Promise.resolve({ data: {} }));
  mocks.put.mockResolvedValue({ data: {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const login = (role = "Customer") => saveSession({ token: `token-${role}`, role, fullName: role === "Admin" ? "Quản Trị" : "Nguyễn Văn Kỳ" });
const hub = () => mocks.connections.at(-1);

async function renderAt(path, ui = <ChatWidget />, routePath = "*") {
  let result;
  await act(async () => {
    result = render(<MemoryRouter initialEntries={[path]}><ChatProvider><Routes><Route path={routePath} element={ui} /></Routes></ChatProvider></MemoryRouter>);
  });
  return result;
}
async function openWidget() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Mở chat tư vấn/ })); });
  return screen.getByRole("textbox", { name: "Tin nhắn" });
}
async function type(input, text) { await act(async () => { fireEvent.change(input, { target: { value: text } }); }); }
const sendCalls = () => mocks.post.mock.calls.filter(([path]) => path.endsWith("/messages"));

describe("chat widget visibility", () => {
  it("shows the bubble on storefront pages and hides it on /lien-he, /admin and for admins", async () => {
    login();
    await renderAt("/");
    expect(screen.getByRole("button", { name: "Mở chat tư vấn" })).toBeTruthy();
    expect(hub().url).toBe("http://localhost:5113/hubs/chat");
    cleanup();
    await renderAt("/lien-he");
    expect(screen.queryByRole("button", { name: /Mở chat tư vấn/ })).toBeNull();
    cleanup();
    await renderAt("/admin/orders");
    expect(screen.queryByRole("button", { name: /Mở chat tư vấn/ })).toBeNull();
    cleanup();
    login("Admin");
    await renderAt("/shop");
    expect(screen.queryByRole("button", { name: /Mở chat tư vấn/ })).toBeNull();
  });

  it("opens with focus in the composer, closes on Escape and returns focus to the bubble", async () => {
    login();
    await renderAt("/");
    const input = await openWidget();
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("heading", { name: "Gem Aurelia · Tư vấn viên" })).toBeTruthy();
    expect(screen.getByRole("log")).toBeTruthy();
    expect(screen.getByRole("log").getAttribute("aria-live")).toBe("polite");
    await act(async () => { fireEvent.keyDown(input, { key: "Escape" }); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mở chat tư vấn" }));
  });

  it("shows a guest login prompt that returns to the current page", async () => {
    await renderAt("/product/5");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mở chat tư vấn" })); });
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login?next=%2Fproduct%2F5");
    expect(screen.getByRole("link", { name: "Đăng ký" }).getAttribute("href")).toBe("/register?next=%2Fproduct%2F5");
    expect(mocks.connections).toHaveLength(0);
  });
});

describe("customer messaging", () => {
  it("sends optimistically, marks failure and retries with the same clientMessageId", async () => {
    login();
    let fail;
    mocks.post.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
    await renderAt("/");
    const input = await openWidget();
    await type(input, "  Cho tôi hỏi giá ruby  ");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const log = screen.getByRole("log");
    expect(within(log).getByText("Cho tôi hỏi giá ruby")).toBeTruthy();
    expect(within(log).getByText("Đang gửi…")).toBeTruthy();
    expect(input.value).toBe("");
    const first = sendCalls()[0][1];
    expect(first.body).toBe("Cho tôi hỏi giá ruby");
    expect(first.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
    await act(async () => { fail({ response: { status: 429, data: { message: "Bạn gửi quá nhiều tin nhắn. Vui lòng thử lại sau." } } }); });
    expect(within(log).getByRole("alert").textContent).toContain("Bạn gửi quá nhiều tin nhắn");
    await act(async () => { fireEvent.click(within(log).getByRole("button", { name: /Thử lại/ })); });
    expect(sendCalls()).toHaveLength(2);
    expect(sendCalls()[1][1].clientMessageId).toBe(first.clientMessageId);
    expect(within(log).queryByRole("alert")).toBeNull();
    expect(within(log).queryByText("Đang gửi…")).toBeNull();
    // The realtime echo of the same message must not duplicate it.
    await act(async () => { hub().handlers.ChatMessage({ conversationId: 7, message: { ...first, id: 1001, senderRole: "Customer", createdAt: iso() } }); });
    expect(within(log).getAllByText("Cho tôi hỏi giá ruby")).toHaveLength(1);
  });

  it("Enter sends, Shift+Enter keeps a new line, IME composition never sends", async () => {
    login();
    await renderAt("/");
    const input = await openWidget();
    await type(input, "Dòng 1");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter", shiftKey: true }); });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter", isComposing: true }); });
    expect(sendCalls()).toHaveLength(0);
    await type(input, "Dòng 1\nDòng 2");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(sendCalls()).toHaveLength(1);
    expect(sendCalls()[0][1].body).toBe("Dòng 1\nDòng 2");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(sendCalls()).toHaveLength(1);
  });

  it("renders message bodies as text, never as HTML, and unavailable products without links", async () => {
    login();
    chatPage.messages = [staffMessage(1, "<img src=x onerror=alert(1)><b>Xin chào</b> <a href=\"javascript:alert(1)\">link</a>")];
    chatPage.messages.push(customerMessage(2, "Mẫu này còn không?", { productId: 9, product: { id: 9, name: "Sapphire đã ngừng bán", price: 1, imageUrl: null, isAvailable: false } }));
    await renderAt("/");
    await openWidget();
    const log = screen.getByRole("log");
    expect(log.querySelector("img[src=x], b, a[href^=javascript]")).toBeNull();
    expect(log.textContent).toContain("<img src=x onerror=alert(1)><b>Xin chào</b>");
    expect(within(log).getByText("Sapphire đã ngừng bán").closest("a")).toBeNull();
    expect(within(log).getByText("Sản phẩm không còn kinh doanh")).toBeTruthy();
  });

  it("receives realtime messages, counts unread while closed and marks read when opened", async () => {
    login(); unreadCount = 1;
    chatPage.messages = [staffMessage(3, "Chào bạn")];
    await renderAt("/");
    expect(screen.getByRole("button", { name: "Mở chat tư vấn, 1 tin nhắn chưa đọc" })).toBeTruthy();
    await act(async () => { hub().handlers.ChatMessage({ conversationId: 7, message: staffMessage(4, "Bạn cần hỗ trợ gì?") }); });
    expect(screen.getByRole("button", { name: "Mở chat tư vấn, 2 tin nhắn chưa đọc" }).textContent).toContain("2");
    chatPage.messages = [staffMessage(3, "Chào bạn"), staffMessage(4, "Bạn cần hỗ trợ gì?")];
    await openWidget();
    expect(mocks.post).toHaveBeenCalledWith("/chat/me/read", { lastMessageId: 4 });
    await act(async () => { hub().handlers.ChatMessage({ conversationId: 7, message: staffMessage(5, "Mình gửi bạn mẫu nhé") }); });
    expect(within(screen.getByRole("log")).getByText("Mình gửi bạn mẫu nhé")).toBeTruthy();
    expect(mocks.post).toHaveBeenCalledWith("/chat/me/read", { lastMessageId: 5 });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đóng khung chat" })); });
    expect(screen.getByRole("button", { name: "Mở chat tư vấn" }).textContent).not.toMatch(/\d/);
  });

  it("shows typing, 'Đã xem' receipts and reloads after reconnect", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    login();
    chatPage.messages = [customerMessage(10, "Còn hàng không ạ?")];
    await renderAt("/");
    await openWidget();
    expect(screen.queryByText("Đã xem")).toBeNull();
    await act(async () => { hub().handlers.ChatRead({ conversationId: 7, side: "Staff", lastReadId: 10 }); });
    expect(screen.getByText("Đã xem")).toBeTruthy();
    await act(async () => { hub().handlers.Typing({ conversationId: 7, side: "Staff" }); });
    expect(screen.getByText("Tư vấn viên đang soạn tin…")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(screen.queryByText("Tư vấn viên đang soạn tin…")).toBeNull();
    chatPage.messages = [customerMessage(10, "Còn hàng không ạ?"), staffMessage(11, "Dạ còn ạ")];
    await act(async () => { hub().handlers.reconnecting(); });
    expect(screen.getByText("Đang kết nối lại…")).toBeTruthy();
    await act(async () => { hub().handlers.reconnected(); });
    expect(screen.getByText("Dạ còn ạ")).toBeTruthy();
  });

  it("quick replies send directly; the product chip attaches the product", async () => {
    login();
    const product = { id: 42, name: "Nhẫn Ruby Hoàng Gia", price: 15000000, imageUrl: "/uploads/r.jpg" };
    await renderAt("/product/42", <><ChatProductContext product={product} /><ChatWidget /></>);
    const input = await openWidget();
    expect(screen.getByRole("link", { name: "Đặt lịch tại showroom" }).getAttribute("href")).toBe("/hen-lich");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Kiểm định đá quý" })); });
    expect(sendCalls()[0][1]).toEqual({ clientMessageId: expect.any(String), body: "Tôi muốn kiểm định đá quý." });
    expect(screen.queryByRole("button", { name: "Tư vấn chọn đá" })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Hỏi về sản phẩm này" })); });
    expect(screen.getByText("Nhẫn Ruby Hoàng Gia")).toBeTruthy();
    await act(async () => { fireEvent.submit(input.closest("form")); });
    expect(sendCalls()[1][1]).toMatchObject({ body: "Tôi muốn hỏi về sản phẩm này.", productId: 42 });
    const card = within(screen.getByRole("log")).getByRole("link", { name: /Nhẫn Ruby Hoàng Gia/ });
    expect(card.getAttribute("href")).toBe("/product/42");
  });

  it("stops the hub when the session changes", async () => {
    login();
    await renderAt("/");
    const first = hub();
    await act(async () => { login("Admin"); });
    expect(first.stop).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Mở chat tư vấn/ })).toBeNull();
  });
});

describe("contact page", () => {
  it("guest sees login/register with next=/lien-he, working hours and no empty contact card", async () => {
    await renderAt("/lien-he", <Contact />);
    expect(screen.getByRole("heading", { level: 1, name: "Liên hệ Gem Aurelia" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login?next=%2Flien-he");
    expect(screen.getByRole("link", { name: "Đăng ký" }).getAttribute("href")).toBe("/register?next=%2Flien-he");
    expect(screen.getByRole("link", { name: "Đặt lịch tư vấn" }).getAttribute("href")).toBe("/hen-lich");
    expect(screen.getByText("Chủ Nhật")).toBeTruthy();
    expect(screen.getByText("09:00 – 12:00")).toBeTruthy();
    expect(document.querySelector("[aria-current=date]")).toBeTruthy();
    expect(screen.getByText(/Tết Dương lịch/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Thông tin liên hệ" })).toBeNull();
  });

  it("logged-in customer chats in the big panel", async () => {
    login();
    chatPage.messages = [staffMessage(1, "Xin chào Kỳ")];
    await renderAt("/lien-he", <><Contact /><ChatWidget /></>);
    expect(screen.queryByRole("button", { name: /Mở chat tư vấn/ })).toBeNull();
    expect(within(screen.getByRole("log")).getByText("Xin chào Kỳ")).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "Tin nhắn" });
    await type(input, "Tôi muốn đặt lịch");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" })); });
    expect(sendCalls()[0][0]).toBe("/chat/me/messages");
  });
});

describe("admin inbox", () => {
  const conversation = (id, name, unread = 0) => ({ id, status: "Open", unreadCount: unread, lastMessageAt: iso(3),
    customer: { id: id * 10, fullName: name, email: `${id}@example.test`, phone: "0900000000", orderCount: 2 },
    lastMessage: { id: id * 100, senderRole: "Customer", body: `Tin của ${name}`, createdAt: iso(3) } });

  it("selects a conversation, replies, receives realtime messages and toggles status", async () => {
    login("Admin"); unreadCount = 1;
    conversations = [conversation(1, "Trần Thị An", 1), conversation(2, "Lê Văn Bình")];
    adminMessages = { conversation: { id: 1, customerLastReadId: 0, staffLastReadId: 0 }, messages: [customerMessage(100, "Tin của Trần Thị An", { conversationId: 1 })], hasMore: false };
    await renderAt("/admin/chat", <><AdminChatNavLink /><AdminChat /></>);
    expect(screen.getByRole("link", { name: /Tin nhắn/ }).textContent).toContain("1");
    expect(screen.getByText("1 tin chưa đọc")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Trần Thị An/ })); });
    expect(mocks.get).toHaveBeenCalledWith("/admin/chat/conversations/1/messages?take=30");
    expect(mocks.post).toHaveBeenCalledWith("/admin/chat/conversations/1/read", { lastMessageId: 100 });
    expect(screen.getByRole("link", { name: "1@example.test" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Xem lịch hẹn của khách" }).getAttribute("href")).toBe("/admin/appointments?q=1%40example.test");
    const input = screen.getByRole("textbox", { name: "Trả lời Trần Thị An" });
    await type(input, "Chào chị An, em hỗ trợ ngay ạ");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const [path, body] = sendCalls()[0];
    expect(path).toBe("/admin/chat/conversations/1/messages");
    expect(body.body).toBe("Chào chị An, em hỗ trợ ngay ạ");
    const log = screen.getByRole("log");
    expect(within(log).getByText("Chào chị An, em hỗ trợ ngay ạ")).toBeTruthy();
    await act(async () => { hub().handlers.Typing({ conversationId: 1, side: "Customer" }); });
    expect(screen.getByText("Trần Thị An đang soạn tin…")).toBeTruthy();
    const listCalls = mocks.get.mock.calls.filter(([p]) => p.startsWith("/admin/chat/conversations?")).length;
    await act(async () => { hub().handlers.ChatMessage({ conversationId: 1, message: customerMessage(101, "Cảm ơn em", { conversationId: 1 }) }); });
    expect(within(log).getByText("Cảm ơn em")).toBeTruthy();
    await act(async () => { hub().handlers.ChatMessage({ conversationId: 2, message: customerMessage(201, "Tin hội thoại khác", { conversationId: 2 }) }); });
    expect(within(log).queryByText("Tin hội thoại khác")).toBeNull();
    expect(mocks.get.mock.calls.filter(([p]) => p.startsWith("/admin/chat/conversations?")).length).toBeGreaterThan(listCalls);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đóng hội thoại" })); });
    expect(mocks.put).toHaveBeenCalledWith("/admin/chat/conversations/1/status", { status: "Closed" });
    expect(screen.getByRole("button", { name: "Mở lại hội thoại" })).toBeTruthy();
  });
});

describe("chat model", () => {
  it("merges optimistic copies by clientMessageId and groups by day and sender", () => {
    const pending = { id: null, clientMessageId: "abc", senderRole: "Customer", body: "Hi", status: "sending", createdAt: iso() };
    const merged = mergeMessages([pending], [normalizeMessage({ id: 9, clientMessageId: "ABC", senderRole: "Customer", body: "Hi", createdAt: iso() })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 9, status: "sent" });
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const days = groupMessages([
      normalizeMessage({ id: 1, senderRole: "Staff", body: "a", createdAt: yesterday }),
      normalizeMessage({ id: 2, senderRole: "Customer", body: "b", createdAt: iso(2) }),
      normalizeMessage({ id: 3, senderRole: "Customer", body: "c", createdAt: iso(1) }),
    ]);
    expect(days.map(day => day.label)).toEqual(["Hôm qua", "Hôm nay"]);
    expect(days[1].groups).toHaveLength(1);
    expect(days[1].groups[0].messages).toHaveLength(2);
  });
});

it("ChatPanel without provider-backed session renders the guest state", async () => {
  await act(async () => { render(<MemoryRouter><ChatProvider><ChatPanel /></ChatProvider></MemoryRouter>); });
  expect(screen.getByText(/Đăng nhập để trò chuyện với tư vấn viên/)).toBeTruthy();
});
