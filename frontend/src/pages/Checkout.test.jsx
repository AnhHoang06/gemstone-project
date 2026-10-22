import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock("react-router-dom", async original => ({ ...await original(), useNavigate: () => mocks.navigate }));
import Checkout from "./Checkout";
import { CommerceContext } from "../commerce/context";
import { saveSession } from "../auth/session";

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); mocks.post.mockReset(); mocks.navigate.mockReset();
  saveSession({ token: "A", role: "Customer", fullName: "A" });
  mocks.get.mockResolvedValue({ data: { id: 1, fullName: "Customer A", phone: "0900000000", address: "Address A" } });
});
afterEach(cleanup);
async function mount() {
  let view;
  await act(async () => { view = render(<MemoryRouter><CommerceContext.Provider value={{ token: "A", cart: { items: [{ productId: 1, name: "Gem", quantity: 1, lineTotal: 100 }], total: 100 }, refreshCart: vi.fn() }}><Checkout /></CommerceContext.Provider></MemoryRouter>); });
  return view.container.querySelector("form");
}
it("keeps the same request ID across an ambiguous failure and blocks double submit", async () => {
  let reject;
  mocks.post.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  const form = await mount();
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.post).toHaveBeenCalledTimes(1);
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

it("keeps the key after a busy conflict so retry cannot duplicate an in-flight checkout", async () => {
  mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { code: "request_busy", message: "Try again" } } });
  const form = await mount();
  await act(async () => { fireEvent.submit(form); });
  expect(sessionStorage.getItem("commerce-checkout:1")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Thử lại cùng yêu cầu" })).toBeTruthy();
});
