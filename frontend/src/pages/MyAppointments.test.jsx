import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), connections: [], urls: [] }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, put: mocks.put }, API_ORIGIN: "http://localhost:5113" }));
vi.mock("@microsoft/signalr", () => ({
  LogLevel: { None: 6 },
  HubConnectionBuilder: class {
    withUrl(url) { mocks.urls.push(url); return this; } withAutomaticReconnect() { return this; } configureLogging() { return this; }
    build() {
      const handlers = {};
      const connection = { handlers, on: (name, fn) => { handlers[name] = fn; }, onreconnecting: vi.fn(), onreconnected: vi.fn(), onclose: vi.fn(),
        start: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) };
      mocks.connections.push(connection); return connection;
    }
  },
}));
import MyAppointments from "./MyAppointments";
import { clearSession, saveSession } from "../auth/session";

const appointment = (id, overrides) => ({ id, serviceName: "Kiểm tra & đánh giá đá quý", price: 500000, startAt: "2026-11-05T09:00:00", endAt: "2026-11-05T09:45:00",
  status: "Pending", contactName: "An", phone: "0901234567", isUpcoming: true, canCancel: true, ...overrides });
let list;

beforeEach(() => {
  localStorage.clear(); mocks.connections.length = 0; mocks.urls.length = 0;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  saveSession({ token: "A", role: "Customer", fullName: "An" });
  list = [
    appointment(1),
    appointment(2, { status: "Confirmed", startAt: "2026-11-02T10:00:00", endAt: "2026-11-02T11:00:00", canCancel: false }),
    appointment(3, { status: "Cancelled", startAt: "2026-10-20T09:00:00", isUpcoming: false, canCancel: false, cancelledBy: "Admin", cancelReason: "Showroom bận" }),
  ];
  mocks.get.mockReset(); mocks.put.mockReset();
  mocks.get.mockImplementation(() => Promise.resolve({ data: list.map(item => ({ ...item })) }));
});
afterEach(() => { cleanup(); clearSession(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });

async function mount() {
  await act(async () => { render(<MemoryRouter><MyAppointments /></MemoryRouter>); });
}

it("splits upcoming and past appointments and only offers cancel when allowed", async () => {
  await mount();
  expect(mocks.urls).toEqual(["http://localhost:5113/hubs/orders"]);
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(2);
  // Upcoming sorted soonest first.
  expect(within(items[0]).getByText("Đã xác nhận")).toBeTruthy();
  expect(within(items[0]).queryByRole("button", { name: "Hủy lịch hẹn" })).toBeNull();
  expect(within(items[0]).getByText(/ít nhất 2 giờ/)).toBeTruthy();
  expect(within(items[1]).getByText("Chờ xác nhận")).toBeTruthy();
  expect(within(items[1]).getByRole("button", { name: "Hủy lịch hẹn" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Đã qua và đã hủy/ }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Đã hủy")).toBeTruthy();
  expect(screen.getByText("Cửa hàng đã hủy lịch: Showroom bận")).toBeTruthy();
});

it("cancels through a dialog with an optional reason", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Hủy lịch hẹn" }));
  const dialog = screen.getByRole("dialog", { name: "Hủy lịch hẹn #1?" });
  fireEvent.change(within(dialog).getByLabelText(/Lý do hủy/), { target: { value: "Bận việc đột xuất" } });
  mocks.put.mockResolvedValueOnce({ data: { ...list[0], status: "Cancelled" } });
  list[0] = { ...list[0], status: "Cancelled", isUpcoming: false, cancelledBy: "Customer", cancelReason: "Bận việc đột xuất" };
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" })); });
  expect(mocks.put).toHaveBeenCalledWith("/appointments/1/cancel", { reason: "Bận việc đột xuất" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Đã hủy lịch hẹn #1.")).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

it("shows the server reason when cancelling is rejected", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Hủy lịch hẹn" }));
  mocks.put.mockRejectedValueOnce({ response: { status: 409, data: { code: "too_late", message: "Chỉ có thể hủy lịch trước giờ hẹn ít nhất 2 giờ. Vui lòng liên hệ cửa hàng." } } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" })); });
  expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain("ít nhất 2 giờ");
});

it("refreshes when an AppointmentChanged event arrives", async () => {
  await mount();
  expect(mocks.get).toHaveBeenCalledTimes(1);
  list[0] = { ...list[0], status: "Confirmed" };
  await act(async () => { mocks.connections[0].handlers.AppointmentChanged({ appointmentId: 1 }); });
  expect(mocks.get).toHaveBeenCalledTimes(2);
  expect(screen.getAllByText("Đã xác nhận")).toHaveLength(2);
});
