import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Cart from "../pages/Cart";
import { formatPrice } from "../utils/formatPrice";
const mocks = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn(), connections: [], failStart: false }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, request: mocks.request }, API_ORIGIN: "http://localhost:5113", resolveImageUrl: value => value }));
vi.mock("@microsoft/signalr", () => ({
  LogLevel: { None: 6 },
  HubConnectionBuilder: class {
    withUrl() { return this; } withAutomaticReconnect() { return this; } configureLogging() { return this; }
    build() {
      const handlers = {};
      const connection = {
        handlers,
        on: (name, fn) => { handlers[name] = fn; },
        onreconnecting: fn => { handlers.reconnecting = fn; },
        onreconnected: fn => { handlers.reconnected = fn; },
        onclose: fn => { handlers.close = fn; },
        start: vi.fn(() => {
          if (mocks.failStart) { mocks.failStart = false; return Promise.reject(new Error("offline")); }
          return Promise.resolve();
        }),
        stop: vi.fn(() => Promise.resolve()),
      };
      mocks.connections.push(connection); return connection;
    }
  },
}));
import CommerceProvider from "./CommerceProvider";
import { useCommerce } from "./context";
import useOrdersData from "./useOrdersData";
import { clearSession, saveSession } from "../auth/session";

function Probe() {
  const { token, cart, cartLoading, mutateCart, connectionState } = useCommerce();
  const orders = useOrdersData("/orders");
  return <><p data-testid="token">{token}</p><p data-testid="cart">{cart?.totalQuantity ?? "empty"}</p>
    <p data-testid="loading">{String(cartLoading)}</p>
    <button onClick={() => void mutateCart("post", "/cart/items/1", { quantity: 1 })}>Add</button>
    <p data-testid="connection">{connectionState}</p><p data-testid="orders">{orders.data?.length ?? "loading"}</p></>;
}
const session = token => saveSession({ token, role: "Customer", fullName: token });
const cartResponse = count => ({ data: { items: [], totalQuantity: count, total: count } });

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); mocks.connections.length = 0; mocks.failStart = false;
  mocks.get.mockReset(); mocks.request.mockReset();
  mocks.get.mockImplementation(path => Promise.resolve(path === "/cart" ? cartResponse(1) : { data: [] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("user-scoped commerce lifecycle", () => {
  it("persists +/- immediately, prevents duplicate requests and renders server totals", async () => {
    const response = quantity => ({ data: { items: [{ productId: 1, name: "Ruby", price: 1000000,
      quantity, lineTotal: 1000000 * quantity, stock: 5, isActive: true }], total: 1000000 * quantity, totalQuantity: quantity } });
    mocks.get.mockResolvedValue(response(1));
    let complete;
    mocks.request.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    session("A");
    await act(async () => { render(<MemoryRouter><CommerceProvider><Cart /></CommerceProvider></MemoryRouter>); });
    expect(screen.queryByRole("button", { name: "Cập nhật" })).toBeNull();
    expect(screen.getByRole("button", { name: "Giảm số lượng Ruby" }).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Ruby" }));
      fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Ruby" }));
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("spinbutton").disabled).toBe(true);
    expect(screen.queryByRole("link", { name: "Đặt hàng" })).toBeNull();
    expect(mocks.request).toHaveBeenCalledWith({ method: "put", url: "/cart/items/1", data: { quantity: 2 } });
    expect(screen.queryByText(formatPrice(2000000))).toBeNull();
    await act(async () => { complete(response(2)); });
    expect(screen.getByRole("spinbutton").value).toBe("2");
    expect(screen.getByRole("cell", { name: formatPrice(2000000) })).toBeTruthy();
    expect(screen.getByText(/Tổng:/).textContent).toBe(`Tổng: ${formatPrice(2000000)}`);
    expect(screen.queryByText(/Số lượng đã lưu|Bạn đã thay đổi|Nhấn.*Cập nhật/)).toBeNull();
    expect(screen.getByRole("link", { name: "Đặt hàng" })).toBeTruthy();
    mocks.request.mockResolvedValueOnce(response(1));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Giảm số lượng Ruby" })); });
    expect(mocks.request).toHaveBeenLastCalledWith({ method: "put", url: "/cart/items/1", data: { quantity: 1 } });
    expect(screen.getByRole("spinbutton").value).toBe("1");
    expect(screen.getByRole("button", { name: "Giảm số lượng Ruby" }).disabled).toBe(true);
  });

  it("saves manual input on blur/Enter, restores server quantity on failure and validates input", async () => {
    const response = quantity => ({ data: { items: [{ productId: 1, name: "Ruby", price: 1000000,
      quantity, lineTotal: 1000000 * quantity, stock: 5, isActive: true }], total: 1000000 * quantity, totalQuantity: quantity } });
    mocks.get.mockResolvedValue(response(1)); session("A");
    await act(async () => { render(<MemoryRouter><CommerceProvider><Cart /></CommerceProvider></MemoryRouter>); });
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2" } });
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.request.mockResolvedValueOnce(response(2));
    await act(async () => { fireEvent.blur(input); });
    expect(input.value).toBe("2");
    expect(screen.getByRole("link", { name: "Đặt hàng" })).toBeTruthy();

    fireEvent.change(input, { target: { value: "3" } });
    let fail;
    mocks.request.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
    // Enter submits the quantity form; a following blur must not submit it again.
    await act(async () => { fireEvent.submit(input.closest("form")); fireEvent.blur(input); });
    expect(mocks.request).toHaveBeenCalledTimes(2);
    await act(async () => { fail({ response: { status: 409, data: { message: "Không đủ tồn kho." } } }); });
    expect(input.value).toBe("2");
    expect(screen.getByText(/Không cập nhật được số lượng/)).toBeTruthy();
    expect(screen.getByText(/Tổng:/).textContent).toBe(`Tổng: ${formatPrice(2000000)}`);
    for (const invalid of ["", "0", "1.5", "10001"]) {
      fireEvent.change(input, { target: { value: invalid } });
      await act(async () => { fireEvent.blur(input); });
      expect(input.value).toBe("2");
      expect(screen.getByText("Số lượng phải là số nguyên từ 1 đến 10.000.")).toBeTruthy();
    }
    expect(mocks.request).toHaveBeenCalledTimes(2);
    mocks.request.mockResolvedValueOnce(response(3));
    fireEvent.change(input, { target: { value: "3" } });
    await act(async () => { fireEvent.submit(input.closest("form")); });
    expect(input.value).toBe("3");
    expect(screen.getByRole("link", { name: "Đặt hàng" })).toBeTruthy();
  });

  it("finishes loading after mutation and ignores a late initial cart GET", async () => {
    const pending = [];
    mocks.get.mockImplementation(path => path === "/cart"
      ? new Promise(resolve => pending.push(resolve)) : Promise.resolve({ data: [] }));
    mocks.request.mockResolvedValue(cartResponse(3));
    session("A");
    await act(async () => { render(<CommerceProvider><Probe /></CommerceProvider>); });
    expect(pending.length).toBeGreaterThan(0);
    expect(screen.getByTestId("loading").textContent).toBe("true");
    await act(async () => { fireEvent.click(screen.getByText("Add")); });
    expect(screen.getByTestId("cart").textContent).toBe("3");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    await act(async () => { pending.forEach(resolve => resolve(cartResponse(99))); });
    expect(screen.getByTestId("cart").textContent).toBe("3");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("stops the old hub and ignores delayed responses after account change/logout", async () => {
    const oldResponses = [];
    mocks.get.mockImplementation(path => path === "/cart" && localStorage.getItem("token") === "A"
      ? new Promise(resolve => oldResponses.push(resolve))
      : Promise.resolve(path === "/cart" ? cartResponse(2) : { data: [] }));
    session("A");
    await act(async () => { render(<CommerceProvider><Probe /></CommerceProvider>); });
    const oldHub = mocks.connections[0];
    await act(async () => { session("B"); });
    expect(oldHub.stop).toHaveBeenCalled();
    expect(screen.getByTestId("cart").textContent).toBe("2");
    await act(async () => { oldResponses.forEach(resolve => resolve(cartResponse(99))); });
    expect(screen.getByTestId("cart").textContent).toBe("2");
    const currentHub = mocks.connections.at(-1);
    sessionStorage.setItem("commerce-checkout:2", "private draft");
    await act(async () => { clearSession(); });
    expect(currentHub.stop).toHaveBeenCalled();
    expect(screen.getByTestId("cart").textContent).toBe("empty");
    expect(screen.getByTestId("token").textContent).toBe("");
    expect(sessionStorage.getItem("commerce-checkout:2")).toBeNull();
  });

  it("reloads cart/orders after reconnect to recover missed events", async () => {
    session("A");
    await act(async () => { render(<CommerceProvider><Probe /></CommerceProvider>); });
    expect(screen.getByTestId("orders").textContent).toBe("0");
    mocks.get.mockImplementation(path => Promise.resolve(path === "/cart" ? cartResponse(7) : { data: [{ id: 1 }] }));
    const hub = mocks.connections[0];
    await act(async () => { hub.handlers.reconnecting(); });
    expect(screen.getByTestId("connection").textContent).toBe("Đang kết nối lại");
    await act(async () => { hub.handlers.reconnected(); });
    expect(screen.getByTestId("connection").textContent).toBe("Đã kết nối");
    expect(screen.getByTestId("orders").textContent).toBe("1");
    expect(screen.getByTestId("cart").textContent).toBe("7");
  });

  it("retries initial connection failure and cancels retry on logout", async () => {
    vi.useFakeTimers(); mocks.failStart = true; session("A");
    await act(async () => { render(<CommerceProvider><Probe /></CommerceProvider>); });
    expect(screen.getByTestId("connection").textContent).toContain("Mất kết nối");
    const hub = mocks.connections[0];
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(hub.start).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("connection").textContent).toBe("Đã kết nối");
    await act(async () => { hub.handlers.close(); clearSession(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(hub.start).toHaveBeenCalledTimes(2);
  });
});
