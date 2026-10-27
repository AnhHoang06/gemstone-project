import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/api", () => ({ default: mocks }));
vi.mock("../components/ProductCard", () => ({ default: ({ product }) => <h3>{product.name}</h3> }));
import Products from "./Products";
const products = [
  { id: 1, name: "Ruby A", categoryName: "Ruby", price: 100 },
  { id: 2, name: "Sapphire B", categoryName: "Sapphire", price: 200 },
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockImplementation(path => Promise.resolve({ data: path === "/categories"
    ? [{ id: 1, name: "Ruby" }, { id: 2, name: "Sapphire" }]
    : path.includes("?") ? products.filter(p => p.price >= 200) : products }));
});
afterEach(cleanup);
function Location() { return <output data-testid="url">{useLocation().search}</output>; }
it("applies supported server price parameters and clears category/search/price from the empty state", async () => {
  render(<MemoryRouter initialEntries={["/shop?category=ruby"]}><Products /><Location /></MemoryRouter>);
  await screen.findByRole("heading", { name: "Ruby A" });
  fireEvent.change(screen.getByLabelText("Giá từ (₫)"), { target: { value: "200" } });
  fireEvent.change(screen.getByLabelText("Giá đến (₫)"), { target: { value: "300" } });
  fireEvent.click(screen.getByRole("button", { name: "Lọc", exact: true }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/products?minPrice=200&maxPrice=300"));
  await screen.findByText("0 sản phẩm phù hợp");
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "missing" } });
  fireEvent.change(screen.getByLabelText("Sắp xếp sản phẩm"), { target: { value: "price-desc" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem tất cả đá quý" }));
  await screen.findByText("2 sản phẩm phù hợp");
  expect(screen.getByTestId("url").textContent).toBe("");
  expect(screen.getByLabelText("Giá từ (₫)").value).toBe("");
  expect(screen.getByLabelText("Giá đến (₫)").value).toBe("");
  expect(screen.getByLabelText("Tìm kiếm").value).toBe("");
  expect(screen.getByLabelText("Sắp xếp sản phẩm").value).toBe("featured");
  expect(screen.getByRole("heading", { name: "Sapphire B" })).toBeTruthy();
});
it("keeps name search and sorting local without inventing new API filters", async () => {
  render(<MemoryRouter><Products /></MemoryRouter>);
  await screen.findByText("2 sản phẩm phù hợp");
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "ruby" } });
  expect(screen.getByText("1 sản phẩm phù hợp")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Sapphire B" })).toBeNull();
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(["/products", "/categories"]);
});
