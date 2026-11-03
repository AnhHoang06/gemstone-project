import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn(), connections: [] }));
vi.mock("../../api/api", () => ({ default: { get: mocks.get, put: mocks.put, post: mocks.post, delete: mocks.delete }, API_ORIGIN: "http://localhost:5113" }));
vi.mock("@microsoft/signalr", () => ({
  LogLevel: { None: 6 },
  HubConnectionBuilder: class {
    withUrl() { return this; } withAutomaticReconnect() { return this; } configureLogging() { return this; }
    build() {
      const handlers = {};
      const connection = { handlers, on: (name, fn) => { handlers[name] = fn; }, onreconnecting: vi.fn(), onreconnected: vi.fn(), onclose: vi.fn(),
        start: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) };
      mocks.connections.push(connection); return connection;
    }
  },
}));
import AdminAppointments from "./AdminAppointments";
import AdminConsultation from "./AdminConsultation";
import { clearSession, saveSession } from "../../auth/session";

const item = (id, overrides) => ({ id, serviceName: "Tư vấn thiết kế trang sức", startAt: "2026-11-03T09:00:00", endAt: "2026-11-03T10:00:00", status: "Pending",
  contactName: "Trần Thị Bình", phone: "0912345678", note: null, hasStarted: false, customer: { id: 5, fullName: "Trần Thị Bình", email: "binh@example.com" }, ...overrides });
let rows;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T01:00:00Z"));
  localStorage.clear(); mocks.connections.length = 0;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  saveSession({ token: "ADMIN", role: "Admin", fullName: "Admin" });
  rows = [item(1), item(2, { status: "Confirmed", startAt: "2026-11-03T14:00:00", endAt: "2026-11-03T15:00:00", hasStarted: true, contactName: "Lê Minh", customer: { id: 6, fullName: "Lê Minh", email: "minh@example.com" } }),
    item(3, { status: "Confirmed", startAt: "2026-11-05T10:00:00", endAt: "2026-11-05T11:00:00" })];
  for (const fn of [mocks.get, mocks.put, mocks.post, mocks.delete]) fn.mockReset();
  mocks.get.mockImplementation(url => url === "/admin/appointments" ? Promise.resolve({ data: { items: rows.map(row => ({ ...row })) } }) : Promise.reject(new Error(url)));
});
afterEach(() => { cleanup(); clearSession(); vi.useRealTimers(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });

describe("AdminAppointments", () => {
  it("loads the next 7 days grouped by date and changes status", async () => {
    await act(async () => { render(<MemoryRouter><AdminAppointments /></MemoryRouter>); });
    expect(mocks.get).toHaveBeenCalledWith("/admin/appointments", { params: { from: "2026-11-02", to: "2026-11-08" } });
    expect(screen.getByRole("heading", { name: /Thứ Ba, 03\/11\/2026/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Thứ Năm, 05\/11\/2026/ })).toBeTruthy();
    expect(screen.getAllByText("binh@example.com").length).toBeGreaterThan(0);
    // Completed / NoShow are offered only after the appointment started.
    expect(screen.queryByRole("button", { name: "Hoàn tất lịch hẹn #1" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hoàn tất lịch hẹn #2" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Vắng mặt lịch hẹn #2" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Hoàn tất lịch hẹn #3" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Vắng mặt lịch hẹn #3" }).disabled).toBe(true);

    mocks.put.mockResolvedValueOnce({ data: { ...rows[0], status: "Confirmed" } });
    rows[0] = { ...rows[0], status: "Confirmed" };
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận lịch hẹn #1" })); });
    expect(mocks.put).toHaveBeenCalledWith("/admin/appointments/1/status", { status: "Confirmed", reason: null });
    expect(screen.getByText("Lịch hẹn #1: Đã xác nhận.")).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("cancels with a reason from the dialog and reloads on conflicts", async () => {
    await act(async () => { render(<MemoryRouter><AdminAppointments /></MemoryRouter>); });
    fireEvent.click(screen.getByRole("button", { name: "Hủy lịch hẹn #3" }));
    const dialog = screen.getByRole("dialog", { name: "Hủy lịch hẹn #3?" });
    fireEvent.change(within(dialog).getByLabelText(/Lý do hủy/), { target: { value: "Chuyên viên nghỉ ốm" } });
    mocks.put.mockRejectedValueOnce({ response: { status: 409, data: { code: "conflict", message: "Lịch hẹn vừa được cập nhật. Vui lòng tải lại." } } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" })); });
    expect(mocks.put).toHaveBeenCalledWith("/admin/appointments/3/status", { status: "Cancelled", reason: "Chuyên viên nghỉ ốm" });
    expect(within(dialog).getByRole("alert").textContent).toContain("vừa được cập nhật");
    mocks.put.mockResolvedValueOnce({ data: {} });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reads filters from the URL (chat inbox link) and keeps the URL in sync", async () => {
    let location;
    function Spy() { location = useLocation(); return null; }
    await act(async () => { render(<MemoryRouter initialEntries={["/admin/appointments?q=binh%40example.com"]}><Routes>
      <Route path="/admin/appointments" element={<><AdminAppointments /><Spy /></>} /></Routes></MemoryRouter>); });
    expect(mocks.get).toHaveBeenLastCalledWith("/admin/appointments", { params: { from: "2026-11-02", to: "2027-01-01", q: "binh@example.com" } });
    expect(screen.getByRole("searchbox", { name: "Tìm khách hàng" }).value).toBe("binh@example.com");

    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "Pending" } });
    await act(async () => {});
    expect(new URLSearchParams(location.search).get("status")).toBe("Pending");
    expect(new URLSearchParams(location.search).get("q")).toBe("binh@example.com");
    expect(mocks.get).toHaveBeenLastCalledWith("/admin/appointments", { params: { from: "2026-11-02", to: "2027-01-01", status: "Pending", q: "binh@example.com" } });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm khách hàng" }), { target: { value: "0912" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(new URLSearchParams(location.search).get("q")).toBe("0912");
    expect(mocks.get).toHaveBeenLastCalledWith("/admin/appointments", expect.objectContaining({ params: expect.objectContaining({ q: "0912" }) }));
  });

  it("ignores malformed URL filters", async () => {
    await act(async () => { render(<MemoryRouter initialEntries={["/admin/appointments?from=hôm-nay&status=Bogus"]}><AdminAppointments /></MemoryRouter>); });
    expect(mocks.get).toHaveBeenCalledWith("/admin/appointments", { params: { from: "2026-11-02", to: "2026-11-08" } });
  });

  it("refreshes on realtime AppointmentChanged", async () => {
    await act(async () => { render(<MemoryRouter><AdminAppointments /></MemoryRouter>); });
    rows.push(item(9, { startAt: "2026-11-06T09:00:00", contactName: "Khách mới" }));
    await act(async () => { mocks.connections[0].handlers.AppointmentChanged({ appointmentId: 9 }); });
    expect(screen.getByText("Khách mới")).toBeTruthy();
  });
});

describe("AdminConsultation hours", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map(day => ({ dayOfWeek: day, isOpen: true, openTime: "09:00", closeTime: day === 0 ? "12:00" : "18:00", slotMinutes: 60, capacityPerSlot: 2 }));
  it("warns about affected appointments on 409 and saves with force after confirmation", async () => {
    mocks.get.mockImplementation(url => url === "/admin/consultation/services" ? Promise.resolve({ data: [] })
      : url === "/admin/consultation/hours" ? Promise.resolve({ data: { days: week } }) : Promise.reject(new Error(url)));
    await act(async () => { render(<MemoryRouter><AdminConsultation /></MemoryRouter>); });
    const tab = screen.getByRole("tab", { name: "Dịch vụ" });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    await act(async () => {});
    expect(screen.getByRole("tab", { name: "Giờ làm việc" }).getAttribute("aria-selected")).toBe("true");
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Thứ Hai");
    expect(rows[7].textContent).toContain("Chủ Nhật");

    fireEvent.click(screen.getByRole("checkbox", { name: /Chủ Nhật/ }));
    fireEvent.change(screen.getByLabelText("Giờ đóng cửa Thứ Bảy"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu giờ làm việc" }));
    expect(screen.getByText("Giờ mở cửa phải trước giờ đóng cửa.")).toBeTruthy();
    expect(mocks.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Giờ đóng cửa Thứ Bảy"), { target: { value: "17:00" } });

    mocks.put.mockRejectedValueOnce({ response: { status: 409, data: { code: "affects_appointments", message: "Thay đổi này làm 1 lịch hẹn sắp tới nằm ngoài giờ làm việc.",
      appointments: [{ id: 12, startAt: "2026-11-08T10:00:00", serviceName: "Tư vấn bộ sưu tập & quà tặng", status: "Confirmed", contactName: "Phạm Hoa", phone: "0987654321" }] } } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Lưu giờ làm việc" })); });
    const body = mocks.put.mock.calls[0][1];
    expect(body.days).toHaveLength(7);
    expect(body.days.find(day => day.dayOfWeek === 0).isOpen).toBe(false);
    expect(body.days.find(day => day.dayOfWeek === 6).closeTime).toBe("17:00:00");
    expect(mocks.put.mock.calls[0][2]).toEqual({ params: undefined });
    expect(screen.getByRole("heading", { name: "Thay đổi này ảnh hưởng 1 lịch hẹn" })).toBeTruthy();
    expect(screen.getByText("Phạm Hoa")).toBeTruthy();

    mocks.put.mockResolvedValueOnce({ data: { days: week } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Vẫn lưu giờ làm việc" })); });
    expect(mocks.put.mock.calls[1][2]).toEqual({ params: { force: true } });
    expect(mocks.put.mock.calls[1][1]).toEqual(body);
    expect(screen.getByText(/Đã lưu giờ làm việc/)).toBeTruthy();
  });
});
