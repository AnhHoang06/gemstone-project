import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import CategorySidebar from "./CategorySidebar";
import ProductGallery from "./ProductGallery";
import ProductCard from "./ProductCard";
import { WishlistContext } from "../wishlist/context";
import { CommerceContext } from "../commerce/context";

const categories = [{ id: 2, name: "Ruby" }, { id: 4, name: "Sapphire" }];
afterEach(cleanup);
it("uses API category names without inventing groups and keeps selection accessible", () => {
  const onChange = vi.fn();
  render(<CategorySidebar categories={categories} value="ruby" onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Ruby" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Sapphire" }));
  expect(onChange).toHaveBeenLastCalledWith("sapphire");
  fireEvent.click(screen.getByRole("button", { name: "Tất cả đá quý" }));
  expect(onChange).toHaveBeenLastCalledWith("all");
});
it("preserves category IDs for the API-filtered catalog", () => {
  const onChange = vi.fn();
  render(<CategorySidebar categories={categories} value="2" onChange={onChange} byId />);
  fireEvent.click(screen.getByRole("button", { name: "Sapphire" }));
  expect(onChange).toHaveBeenCalledWith("4");
  expect(screen.getByText(/nhấn “Lọc”/)).toBeTruthy();
});
it("shows category loading and errors rather than fake categories", () => {
  const { rerender } = render(<CategorySidebar categories={[]} value="all" loading onChange={() => {}} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<CategorySidebar categories={[]} value="all" error="Không tải được" onChange={() => {}} />);
  expect(screen.getByRole("alert").textContent).toBe("Không tải được");
});
it("starts with the primary image and allows selecting another gallery image", () => {
  render(<ProductGallery product={{ name: "Ruby", images: [{ id: 1, imageUrl: "https://example.invalid/a.jpg" }, { id: 2, imageUrl: "https://example.invalid/b.jpg", isPrimary: true }] }} />);
  expect(screen.getByRole("img", { name: "Ruby" }).getAttribute("src")).toContain("b.jpg");
  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh 1 của Ruby" }));
  expect(screen.getByRole("img", { name: "Ruby" }).getAttribute("src")).toContain("a.jpg");
});
it("preserves alternate detail routes and delegates favorite/cart actions to existing providers", () => {
  const toggle = vi.fn(), mutateCart = vi.fn().mockResolvedValue(true);
  render(<MemoryRouter><WishlistContext.Provider value={{ items: [], toggle }}><CommerceContext.Provider value={{ mutateCart }}>
    <ProductCard product={{ id: 7, name: "Ruby", price: 1000000, stock: 3, type: "Ruby" }} detailPath="/products/7" />
  </CommerceContext.Provider></WishlistContext.Provider></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Xem chi tiết" }).getAttribute("href")).toBe("/products/7");
  fireEvent.click(screen.getByRole("button", { name: "Yêu thích: Ruby" }));
  expect(toggle).toHaveBeenCalledWith(7);
});
