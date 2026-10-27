import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock("react-router-dom", async original => ({ ...await original(), useNavigate: () => mocks.navigate }));
import Checkout from "../commerce/CheckoutSummary";
import { CommerceContext } from "../commerce/context";
import { saveSession } from "../auth/session";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  localStorage.clear(); sessionStorage.clear(); mocks.post.mockReset(); mocks.navigate.mockReset();
  saveSession({ token: "A", role: "Customer", fullName: "A" });
  mocks.get.mockResolvedValue({ data: { id: 1, fullName: "Customer A", phone: "0900000000", address: "Address A" } });
});
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });
async function mount(open = true, bank = false) {
  let view;
  await act(async () => { view = render(<MemoryRouter><CommerceContext.Provider value={{ token: "A", cart: { items: [{ productId: 1, name: "Gem", quantity: 1, lineTotal: 100 }], total: 100 }, refreshCart: vi.fn() }}><Checkout /></CommerceContext.Provider></MemoryRouter>); });
  if (bank) fireEvent.click(screen.getByRole("radio", { name: "Chuyển khoản ngân hàng" }));
  if (open) fireEvent.click(screen.getByRole("button", { name: "Đặt hàng" }));
  return view.container.querySelector("form");
}
it("keeps the same request ID across an ambiguous failure and blocks double submit", async () => {
  let reject;
  mocks.post.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  const form = await mount();
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Hủy' }).disabled).toBe(true);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  const first = mocks.post.mock.calls[0][1];
  expect(first.requestId).toBeTruthy();
  await act(async () => { reject(new Error("Connection lost after commit")); });
  expect(JSON.parse(sessionStorage.getItem("commerce-checkout:1")).requestId).toBe(first.requestId);
  mocks.post.mockResolvedValueOnce({ data: { orderId: 42, replayed: true } });
  await act(async () => { fireEvent.submit(form); });
  expect(mocks.post.mock.calls[1][1]).toEqual(first);
  expect(mocks.navigate).toHaveBeenCalledWith("/orders/42", { replace: true });
  expect(sessionStorage.getItem("commerce-checkout:1")).toBeNull();
});

it("keeps Cart compact and cancellation/Escape creates no order", async () => {
  await mount(false);
  expect(screen.queryByLabelText('Người nhận')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  const trigger = screen.getByRole('button', { name: 'Đặt hàng' });
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Thông tin giao hàng' })).toBeTruthy();
  expect(screen.getByLabelText('Người nhận').value).toBe('Customer A');
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
});

it("keeps the key after a busy conflict so retry cannot duplicate an in-flight checkout", async () => {
  mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { code: "request_busy", message: "Try again" } } });
  const form = await mount();
  await act(async () => { fireEvent.submit(form); });
  expect(sessionStorage.getItem("commerce-checkout:1")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Thử lại cùng yêu cầu" })).toBeTruthy();
});

it("opens bank payment only after the order API confirms creation", async () => {
  let complete;
  mocks.post.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const form = await mount(true, true);
  await act(async () => { fireEvent.submit(form); });
  expect(mocks.post).toHaveBeenCalledWith('/orders', expect.objectContaining({ paymentMethod: 'BankTransfer' }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => { complete({ data: { orderId: 52, paymentMethod: 'BankTransfer' } }); });
  expect(mocks.navigate).toHaveBeenCalledWith('/payment/52', { replace: true });
});

it("uses profile delivery data and keeps edits scoped to the order", async () => {
  const form = await mount();
  expect(screen.getByLabelText('Người nhận').value).toBe('Customer A');
  expect(screen.getByLabelText('Địa chỉ giao hàng').value).toBe('Address A');

  fireEvent.change(screen.getByLabelText('Địa chỉ giao hàng'), { target: { value: 'Order address' } });
  mocks.post.mockResolvedValueOnce({ data: { orderId: 5 } });
  await act(async () => { fireEvent.submit(form); });
  expect(mocks.post).toHaveBeenCalledWith('/orders', expect.objectContaining({ recipientName: 'Customer A', recipientPhone: '0900000000', shippingAddress: 'Order address' }));
  expect(mocks.navigate).toHaveBeenCalledWith('/orders/5', { replace: true });
});

it("blocks missing recipient information with inline errors", async () => {
  mocks.get.mockResolvedValueOnce({ data: { id: 1, fullName: '', phone: '', address: '' } });
  const form = await mount();
  await act(async () => { fireEvent.submit(form); });
  expect(screen.getByText('Vui lòng nhập tên người nhận.')).toBeTruthy();
  expect(screen.getByText('Vui lòng nhập số điện thoại.')).toBeTruthy();
  expect(screen.getByText('Vui lòng nhập địa chỉ giao hàng.')).toBeTruthy();
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it("does not navigate or restore a checkout draft after account switch", async () => {
  let complete;
  mocks.post.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const form = await mount();
  await act(async () => { fireEvent.submit(form); });
  await act(async () => { saveSession({ token: 'B', fullName: 'B', role: 'Customer' }); complete({ data: { orderId: 6 } }); });
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('commerce-checkout:1')).toBeNull();
});

it("recovers an existing checkout request even after the server cart was cleared", async () => {
  const pending = { requestId: crypto.randomUUID(), recipientName: 'Customer A', recipientPhone: '0900000000', shippingAddress: 'Address A', note: '' };
  sessionStorage.setItem('commerce-checkout:1', JSON.stringify(pending));
  await act(async () => { render(<MemoryRouter><CommerceContext.Provider value={{ token: 'A', cart: { items: [], total: 0 }, refreshCart: vi.fn() }}><Checkout /></CommerceContext.Provider></MemoryRouter>); });
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xác nhận' }));
  mocks.post.mockResolvedValueOnce({ data: { orderId: 42, replayed: true } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Thử lại cùng yêu cầu' })); });
  expect(mocks.post).toHaveBeenCalledWith('/orders', pending);
  expect(mocks.navigate).toHaveBeenCalledWith('/orders/42', { replace: true });
});
