import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../../api/api", () => ({ default: { post: mocks.post, get: mocks.get } }));
import Login from "./Login";
import Register from "./Register";
import GuestRoute from "../../components/GuestRoute";
import { clearSession } from "../../auth/session";
import { safeNextPath } from "./nextPath";

// Header (inside AuthLayout) needs commerce + category data; keep it out of these tests.
vi.mock("../../components/Header", () => ({ default: () => null }));

const jwt = (() => {
  const encode = value => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
})();

function Where() { const location = useLocation(); return <p data-testid="where">{location.pathname}{location.search}</p>; }
function mount(entry) {
  render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
    <Route path="*" element={<Where />} />
  </Routes></MemoryRouter>);
}
async function signIn(role = "Customer") {
  mocks.post.mockResolvedValueOnce({ data: { token: jwt, role, fullName: "An" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "an@example.com" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret123" } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")); });
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mocks.post.mockReset(); });
afterEach(() => { cleanup(); clearSession(); });

describe("login ?next=", () => {
  it("returns to an internal next path after signing in", async () => {
    mount("/login?next=%2Fhen-lich");
    expect(screen.getByText(/hoàn tất đặt lịch tư vấn/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng ký" }).getAttribute("href")).toBe("/register?next=%2Fhen-lich");
    await signIn();
    expect(screen.getByTestId("where").textContent).toBe("/hen-lich");
  });

  it("keeps query strings of internal paths", async () => {
    mount(`/login?next=${encodeURIComponent("/shop?q=ruby&page=2")}`);
    await signIn();
    expect(screen.getByTestId("where").textContent).toBe("/shop?q=ruby&page=2");
  });

  it.each([
    "https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/\n/evil.example", "hen-lich",
  ])("ignores external or malformed next=%s", async next => {
    mount(`/login?next=${encodeURIComponent(next)}`);
    await signIn();
    expect(screen.getByTestId("where").textContent).toBe("/");
  });

  it("sends a signed-in visitor of /login?next= straight to the internal path", () => {
    localStorage.setItem("token", jwt); localStorage.setItem("role", "Customer");
    mount("/login?next=%2Fappointments");
    expect(screen.getByTestId("where").textContent).toBe("/appointments");
  });

  it("register keeps next for the login link", () => {
    mount("/register?next=%2Fhen-lich");
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login?next=%2Fhen-lich");
  });
});

describe("safeNextPath", () => {
  it("accepts only same-origin rooted paths", () => {
    expect(safeNextPath("/appointments")).toBe("/appointments");
    expect(safeNextPath("/hen-lich#buoc-3")).toBe("/hen-lich#buoc-3");
    for (const value of [null, "", "//x.y", "/\\x.y", "\\\\x.y", "http://x.y", "/\tx", "/login", "/register?next=/x"]) expect(safeNextPath(value)).toBeNull();
  });
});
