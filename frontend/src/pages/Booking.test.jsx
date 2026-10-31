import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), availability: [] }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, post: mocks.post, put: mocks.put }, API_ORIGIN: "http://localhost:5113" }));
import Booking from "./Booking";
import { clearSession, saveSession } from "../auth/session";

const services = [
  { id: 1, name: "Tư vấn thiết kế trang sức", description: "Thiết kế riêng theo ý tưởng của bạn.", price: 0, durationMinutes: 60, sortOrder: 1 },
  { id: 2, name: "Kiểm tra & đánh giá đá quý", description: "Kiểm tra và đánh giá đá quý tại showroom.", price: 500000, durationMinutes: 45, sortOrder: 2 },
];
const slots = (overrides = {}) => [
  { start: "09:00", end: "10:00", remaining: 2 }, { start: "10:00", end: "11:00", remaining: 1 }, { start: "14:00", end: "15:00", remaining: 0 },
].map(slot => ({ ...slot, ...(overrides[slot.start] || {}) }));
function availability(from, days, overrides = {}) {
  const start = new Date(`${from}T00:00:00Z`);
  return { days: Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    if (date === "2026-11-04") return { date, isOpen: false, reason: "Kiểm kê", slots: [] };
    return { date, isOpen: true, reason: null, slots: slots(overrides[date]) };
  }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T01:00:00Z")); // 08:00 Monday 02/11/2026 in store time
  localStorage.clear(); sessionStorage.clear();
  window.scrollTo = vi.fn();
  mocks.availability = [];
  mocks.get.mockReset(); mocks.post.mockReset(); mocks.put.mockReset();
  mocks.get.mockImplementation((url, config) => {
    if (url === "/consultation/services") return Promise.resolve({ data: services });
    if (url === "/consultation/availability") {
      mocks.availability.push(config.params);
      return Promise.resolve({ data: availability(config.params.from, config.params.days, mocks.overrides?.() || {}) });
    }
    if (url === "/users/me") return Promise.resolve({ data: { id: 7, fullName: "Nguyễn Văn An", phone: "0901234567" } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  mocks.overrides = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); clearSession(); });

async function mount() {
  await act(async () => { render(<MemoryRouter initialEntries={["/hen-lich"]}><Booking /></MemoryRouter>); });
}
const flush = () => act(async () => { await Promise.resolve(); });

async function chooseServiceAndSlot(serviceName = /Kiểm tra & đánh giá/, time = "09:00") {
  fireEvent.click(screen.getByRole("radio", { name: serviceName }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chọn ngày & giờ" }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^Thứ Ba, 03\/11\/2026, còn chỗ/ }));
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${time}`) }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục nhập thông tin" }));
}

describe("Booking stepper", () => {
  it("walks through service → date & time → contact and confirms with a success screen", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    const summary = screen.getByRole("complementary", { name: "Lịch hẹn của bạn" });
    expect(screen.getByRole("button", { name: /Bước 2/ }).disabled).toBe(true);
    expect(within(summary).getByRole("button", { name: "Xác nhận đặt lịch" }).disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: /Kiểm tra & đánh giá/ }));
    expect(within(summary).getAllByText("Kiểm tra & đánh giá đá quý").length).toBeGreaterThan(0);
    expect(within(summary).getByText(/500\.000/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chọn ngày & giờ" }));
    await flush();
    expect(mocks.availability[0]).toEqual({ serviceId: 2, from: "2026-11-02", days: 29 });
    // Closed and past days are not selectable.
    const closed = screen.getByRole("button", { name: /^Thứ Tư, 04\/11\/2026, đóng cửa: Kiểm kê/ });
    expect(closed.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(closed);
    expect(screen.getByText(/Chọn một ngày trên lịch/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Thứ Ba, 03\/11\/2026, còn chỗ/ }));
    expect(screen.getByRole("radiogroup", { name: "Buổi sáng" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "10:00 còn 1 chỗ" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /14:00 Hết chỗ/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /^09:00/ }));
    expect(within(summary).getByText("09:00 – 10:00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục nhập thông tin" }));
    await flush();

    expect(screen.getByLabelText("Họ và tên").value).toBe("Nguyễn Văn An");
    expect(screen.getByLabelText("Số điện thoại").value).toBe("0901234567");
    fireEvent.change(screen.getByLabelText(/Ghi chú/), { target: { value: "Xem sapphire" } });
    mocks.post.mockResolvedValueOnce({ data: { id: 41, serviceName: "Kiểm tra & đánh giá đá quý", price: 500000, status: "Pending",
      startAt: "2026-11-03T09:00:00", endAt: "2026-11-03T09:45:00" } });
    await act(async () => { fireEvent.click(within(summary).getByRole("button", { name: "Xác nhận đặt lịch" })); });

    expect(mocks.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ serviceId: 2, date: "2026-11-03", start: "09:00",
      contactName: "Nguyễn Văn An", phone: "0901234567", note: "Xem sapphire", requestId: expect.any(String) }));
    expect(screen.getByRole("heading", { name: "Đã gửi yêu cầu đặt lịch" })).toBeTruthy();
    expect(screen.getByText("#41")).toBeTruthy();
    expect(screen.getByText("Chờ xác nhận")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm vào lịch" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Xem lịch hẹn của tôi" }).getAttribute("href")).toBe("/appointments");
    expect(sessionStorage.getItem("gem-aurelia:booking-request:7")).toBeNull();
    expect(sessionStorage.getItem("gem-aurelia:booking-draft")).toBeNull();
  });

  it("on 409 slot_full reloads times, keeps service and date, and uses a fresh requestId next time", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    await chooseServiceAndSlot();
    await flush();
    mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { code: "slot_full", message: "Khung giờ này vừa hết chỗ. Vui lòng chọn giờ khác." } } });
    mocks.overrides = () => ({ "2026-11-03": { "09:00": { remaining: 0 } } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    await flush();
    const first = mocks.post.mock.calls[0][1];

    expect(mocks.availability).toHaveLength(2);
    expect(screen.getByRole("alert").textContent).toContain("vừa hết chỗ");
    expect(screen.getByRole("radio", { name: /09:00 Hết chỗ/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /^Thứ Ba, 03\/11\/2026, còn chỗ/ }).closest("td").getAttribute("aria-selected")).toBe("true");
    const summary = screen.getByRole("complementary", { name: "Lịch hẹn của bạn" });
    expect(within(summary).getAllByText("Kiểm tra & đánh giá đá quý").length).toBeGreaterThan(0);
    expect(within(summary).getByRole("button", { name: "Xác nhận đặt lịch" }).disabled).toBe(true);
    expect(sessionStorage.getItem("gem-aurelia:booking-request:7")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /^10:00/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục nhập thông tin" }));
    mocks.post.mockResolvedValueOnce({ data: { id: 42, status: "Pending", startAt: "2026-11-03T10:00:00", endAt: "2026-11-03T10:45:00" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    const second = mocks.post.mock.calls[1][1];
    expect(second.start).toBe("10:00");
    expect(second.requestId).not.toBe(first.requestId);
  });

  it("keeps the same requestId after an ambiguous failure and retries the identical request", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    await chooseServiceAndSlot();
    await flush();
    mocks.post.mockRejectedValueOnce(new Error("Network Error"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    const first = mocks.post.mock.calls[0][1];
    expect(JSON.parse(sessionStorage.getItem("gem-aurelia:booking-request:7")).requestId).toBe(first.requestId);
    expect(screen.getByLabelText("Họ và tên").matches(":disabled")).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Chưa xác nhận được kết quả");
    expect(screen.getByText(/Thử lại sẽ dùng cùng mã yêu cầu/)).toBeTruthy();

    mocks.post.mockResolvedValueOnce({ data: { id: 43, status: "Pending", startAt: "2026-11-03T09:00:00", endAt: "2026-11-03T09:45:00" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Thử lại cùng yêu cầu" })); });
    expect(mocks.post.mock.calls[1][1]).toEqual(first);
    expect(screen.getByText("#43")).toBeTruthy();
  });

  it("restores a pending request after reload so the retry reuses its requestId", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    const pending = { requestId: "11111111-2222-3333-4444-555555555555", serviceId: 2, date: "2026-11-03", start: "10:00", contactName: "An", phone: "0901234567", note: null };
    sessionStorage.setItem("gem-aurelia:booking-request:7", JSON.stringify(pending));
    await mount();
    await flush();
    mocks.post.mockResolvedValueOnce({ data: { id: 44, status: "Pending", startAt: "2026-11-03T10:00:00" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Thử lại cùng yêu cầu" })); });
    expect(mocks.post).toHaveBeenCalledWith("/appointments", pending);
  });

  it("asks guests to sign in with a safe next link and keeps their selection across the round-trip", async () => {
    await mount();
    await chooseServiceAndSlot(/Tư vấn thiết kế/, "10:00");
    expect(screen.getByRole("heading", { name: "Đăng nhập để hoàn tất đặt lịch" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login?next=%2Fhen-lich");
    expect(screen.getByRole("link", { name: "Tạo tài khoản" }).getAttribute("href")).toBe("/register?next=%2Fhen-lich");
    expect(screen.queryByLabelText("Họ và tên")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem("gem-aurelia:booking-draft"))).toEqual({ serviceId: 1, date: "2026-11-03", start: "10:00" });

    cleanup();
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    await flush();
    expect(screen.getByLabelText("Họ và tên").value).toBe("Nguyễn Văn An");
    const summary = screen.getByRole("complementary", { name: "Lịch hẹn của bạn" });
    expect(within(summary).getByText("10:00 – 11:00")).toBeTruthy();
    expect(within(summary).getByText("Thứ Ba, 03/11/2026")).toBeTruthy();
  });

  it("drops a restored time that is no longer free and reopens step 2", async () => {
    sessionStorage.setItem("gem-aurelia:booking-draft", JSON.stringify({ serviceId: 2, date: "2026-11-03", start: "14:00" }));
    await mount();
    await flush();
    expect(screen.getByText("Khung giờ 14:00 không còn trống. Vui lòng chọn giờ khác.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bước 2/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows definitive conflicts like limit_reached without reloading times and starts a new request next time", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    await chooseServiceAndSlot();
    await flush();
    mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { code: "limit_reached", message: "Bạn đã có 3 lịch hẹn sắp tới." } } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    expect(mocks.availability).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toBe("Bạn đã có 3 lịch hẹn sắp tới.");
    expect(screen.getByLabelText("Họ và tên").matches(":disabled")).toBe(false);
    expect(sessionStorage.getItem("gem-aurelia:booking-request:7")).toBeNull();
    mocks.post.mockResolvedValueOnce({ data: { id: 45, status: "Pending", replayed: false, startAt: "2026-11-03T09:00:00" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    expect(mocks.post.mock.calls[1][1].requestId).not.toBe(mocks.post.mock.calls[0][1].requestId);
  });

  it("validates contact fields before sending", async () => {
    saveSession({ token: "A", role: "Customer", fullName: "An" });
    await mount();
    await chooseServiceAndSlot();
    await flush();
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "12ab" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" })); });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Số điện thoại không hợp lệ/)).toBeTruthy();
    expect(screen.getByLabelText("Số điện thoại").getAttribute("aria-invalid")).toBe("true");
  });
});
