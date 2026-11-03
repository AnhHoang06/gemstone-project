import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import GuestRoute from "./GuestRoute";
import { saveSession } from "../auth/session";

const encode = value => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
const jwt = exp => `${encode({ alg: "HS256" })}.${encode({ exp })}.c2ln`;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);
function mount(path) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<GuestRoute><p>Login form</p></GuestRoute>} />
    <Route path="/register" element={<GuestRoute><p>Register form</p></GuestRoute>} />
    <Route path="/" element={<p>Customer home</p>} />
    <Route path="/admin/dashboard" element={<p>Admin dashboard</p>} />
  </Routes></MemoryRouter>);
}
it.each(["/login", "/register"])("redirects active Customer from %s", path => {
  saveSession({ token: jwt(Date.now() / 1000 + 600), role: "Customer", fullName: "Test" });
  mount(path); expect(screen.getByText("Customer home")).toBeTruthy();
});
it.each(["/login", "/register"])("redirects active Admin from %s", path => {
  saveSession({ token: jwt(Date.now() / 1000 + 600), role: "Admin", fullName: "Test" });
  mount(path); expect(screen.getByText("Admin dashboard")).toBeTruthy();
});
it.each(["", "invalid", jwt(1), `${encode({})}.${encode({})}.c2ln`])("keeps auth forms available for invalid session %s", token => {
  saveSession({ token, role: "Admin", fullName: "Test" });
  mount("/login"); expect(screen.getByText("Login form")).toBeTruthy();
  cleanup(); mount("/register"); expect(screen.getByText("Register form")).toBeTruthy();
});
