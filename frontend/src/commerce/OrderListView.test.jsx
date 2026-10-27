import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import OrderDetailView from "./OrderDetailView";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), refreshCart: vi.fn() }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, put: mocks.put } }));
import OrderListView from "./OrderListView";
import { CommerceContext } from "./context";
import { saveSession } from "../auth/session";

let orders;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveSession({ token: "A", role: "Customer", fullName: "A" });
  orders = ["Pending", "Confirmed", "Shipping", "Completed", "Cancelled"].map((status, i) =>
    ({ id: i + 1, status, recipientName: "Test", createdAt: "2026-10-22T00:00:00Z", totalAmount: 2000000, itemCount: 2 }));
  mocks.get.mockImplementation(() => Promise.resolve({ data: orders }));
  // jsdom has no native modal implementation; retain the DOM open/close semantics.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });
async function mount(admin = false) {
  await act(async () => { render(<MemoryRouter initialEntries={[admin ? "/admin/orders" : "/orders"]}><CommerceContext.Provider value={{ token: "A", revision: 0,
    connectionState: "Đã kết nối", refreshCart: mocks.refreshCart }}><OrderListView admin={admin} /><LocationProbe /></CommerceContext.Provider></MemoryRouter>); });
}
function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }

it.each([false, true])("opens details by clicking a normal cell (admin=%s)", async admin => {
  await mount(admin);
  const row = screen.getByRole(admin ? "row" : "article", { name: "Mở chi tiết đơn hàng #2" });
  if (!admin) expect(within(row).getByText('2 sản phẩm')).toBeTruthy();
  fireEvent.click(within(row).getByText("Test"));
  expect(screen.getByTestId("location").textContent).toBe(`${admin ? "/admin" : ""}/orders/2`);
});
it.each([[false, "Enter"], [false, " "], [true, "Enter"], [true, " "]])("supports row keyboard navigation (admin=%s, key=%s)", async (admin, key) => {
  await mount(admin);
  const row = screen.getByRole(admin ? "row" : "article", { name: "Mở chi tiết đơn hàng #3" });
  expect(row.tabIndex).toBe(0);
  row.focus(); fireEvent.keyDown(row, { key });
  expect(screen.getByTestId("location").textContent).toBe(`${admin ? "/admin" : ""}/orders/3`);
});
it.each([false, true])("keeps the order-number link working (admin=%s)", async admin => {
  await mount(admin); fireEvent.click(screen.getByRole("link", { name: "#4" }));
  expect(screen.getByTestId("location").textContent).toBe(`${admin ? "/admin" : ""}/orders/4`);
});
it("only offers Pending cancellation, confirms once and refetches the server status", async () => {
  let complete;
  mocks.put.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await mount();
  expect(screen.getAllByRole("button", { name: "Hủy đơn" })).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole("button", { name: "Hủy đơn" }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("button", { name: "Hủy đơn" }), { key: " " });
  expect(screen.getByTestId("location").textContent).toBe("/orders");
  fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));
  expect(screen.getByTestId("location").textContent).toBe("/orders");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(mocks.put).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Xác nhận hủy" });
  await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm); });
  expect(mocks.put).toHaveBeenCalledExactlyOnceWith("/orders/1/cancel");
  expect(screen.getByRole("button", { name: "Đang hủy..." }).disabled).toBe(true);
  orders = orders.map(order => order.id === 1 ? { ...order, status: "Cancelled" } : order);
  await act(async () => { complete({ data: {} }); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Hủy đơn" })).toBeNull();
  expect(screen.getAllByText("Đã hủy")).toHaveLength(2);
  expect(mocks.refreshCart).toHaveBeenCalledOnce();
});
it("shows cancellation failure without inventing a Cancelled state", async () => {
  mocks.put.mockRejectedValue({ response: { status: 409, data: { message: "Không thể hủy đơn." } } });
  await mount(); fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" })); });
  expect(screen.getByRole("alert").textContent).toBe("Không thể hủy đơn.");
  expect(screen.getAllByText("Đã hủy")).toHaveLength(1);
  expect(mocks.refreshCart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Giữ đơn" }));
  expect(screen.getByRole("button", { name: "Hủy đơn" })).toBeTruthy();
});
it("does not add customer cancellation actions to the admin list", async () => {
  await mount(true); expect(screen.queryByRole("button", { name: "Hủy đơn" })).toBeNull();
});

it("filters admin orders using the existing API and keeps rows visible during refresh", async () => {
  await mount(true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Đang giao' })); });
  expect(mocks.get).toHaveBeenLastCalledWith('/orders/admin?status=Shipping');
  expect(screen.getByRole('button', { name: 'Đang giao' }).getAttribute('aria-pressed')).toBe('true');
  let complete;
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tải lại' })); });
  expect(screen.getByRole('row', { name: 'Mở chi tiết đơn hàng #1' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đang cập nhật…' }).disabled).toBe(true);
  await act(async () => { complete({ data: [] }); });
  expect(screen.getByText('Chưa có đơn hàng phù hợp.')).toBeTruthy();
});

it.each([false, true])("shows real detail fields and preserves allowed actions (admin=%s)", async admin => {
  mocks.get.mockResolvedValue({ data: { ...orders[0], recipientPhone: '0901234567', shippingAddress: 'Địa chỉ kiểm thử',
    items: [{ productId: 1, productName: 'Ruby', quantity: 2, unitPrice: 1000000, lineTotal: 2000000 }] } });
  await act(async () => { render(<MemoryRouter initialEntries={['/orders/1']}><CommerceContext.Provider value={{ token: 'A', revision: 0, refreshCart: mocks.refreshCart }}>
    <Routes><Route path="/orders/:id" element={<OrderDetailView admin={admin} />} /></Routes>
  </CommerceContext.Provider></MemoryRouter>); });
  expect(screen.getByText('Địa chỉ kiểm thử')).toBeTruthy();
  expect(screen.getByText('0901234567')).toBeTruthy();
  expect(screen.getByRole('cell', { name: 'Ruby' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: '2' })).toBeTruthy();
  expect(screen.getByText('Hiện tại').closest('li').getAttribute('aria-current')).toBe('step');
  expect(Boolean(screen.queryByRole('button', { name: 'Chuyển: Đã xác nhận' }))).toBe(admin);
  fireEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
  expect(screen.getByRole('group', { name: 'Xác nhận hủy đơn' })).toBeTruthy();
  expect(mocks.put).not.toHaveBeenCalled();
});
