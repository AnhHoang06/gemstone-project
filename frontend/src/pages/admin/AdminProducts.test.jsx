import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("../../api/api", () => ({ default: mocks, resolveImageUrl: value => value }));
import AdminProducts from "./AdminProducts";
import AdminProductForm from "./AdminProductForm";

const product = { id: 1, name: "Ruby", isActive: true, price: 1000000, stock: 5, categoryId: 1, images: [] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: [product, { ...product, id: 2, name: "Hidden", isActive: false }] });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });
async function mount() { await act(async () => { render(<MemoryRouter><AdminProducts /></MemoryRouter>); }); }

it("lists active products only and removes a row only after successful soft deletion", async () => {
  await mount();
  expect(mocks.get).toHaveBeenCalledWith("/products?includeInactive=true");
  expect(screen.queryByText("Hidden")).toBeNull();
  expect(screen.queryByText(/Ngừng bán|Bán lại/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Xóa sản phẩm?" })).toBeTruthy();
  expect(within(dialog).getByText("Dữ liệu lịch sử đơn hàng vẫn được giữ lại.")).toBeTruthy();
  let complete;
  mocks.delete.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const confirm = within(dialog).getByRole("button", { name: "Xóa" });
  await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm); });
  expect(mocks.delete).toHaveBeenCalledExactlyOnceWith("/products/1");
  expect(within(dialog).getByRole("button", { name: "Đang xóa..." }).disabled).toBe(true);
  expect(screen.getByRole("cell", { name: "Ruby" })).toBeTruthy();
  await act(async () => { complete({}); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Ruby")).toBeNull();
});
it("keeps the row and shows a delete failure in the modal", async () => {
  await mount(); mocks.delete.mockRejectedValueOnce({ response: { data: { message: "Không thể xóa." } } });
  fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
  await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa" })); });
  expect(screen.getByRole("alert").textContent).toBe("Không thể xóa.");
  expect(screen.getByRole("cell", { name: "Ruby" })).toBeTruthy();
});
it.each(["404", "inactive"])("blocks the edit form for %s products", async mode => {
  mocks.get.mockImplementation(path => path === "/categories?includeInactive=true" ? Promise.resolve({ data: [] }) :
    mode === "404" ? Promise.reject({ response: { status: 404 } }) : Promise.resolve({ data: { ...product, isActive: false } }));
  await act(async () => { render(<MemoryRouter initialEntries={["/admin/products/edit/1"]}><Routes>
    <Route path="/admin/products/edit/:id" element={<AdminProductForm />} />
  </Routes></MemoryRouter>); });
  expect(mocks.get).toHaveBeenCalledWith("/products/1?includeInactive=true");
  expect(screen.getByRole("alert").textContent).toContain("Sản phẩm không tồn tại hoặc đã bị xóa.");
  expect(screen.queryByRole("textbox")).toBeNull();
});
