import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

function LoginProbe() {
  const location = useLocation();
  return <output data-testid="login">{`${location.pathname}${location.search}`}</output>;
}

afterEach(() => { cleanup(); localStorage.clear(); });

it("sends a signed-out visitor to login with the requested page as next", () => {
  render(<MemoryRouter initialEntries={["/appointments?tab=past"]}><Routes>
    <Route path="/appointments" element={<ProtectedRoute><p>Lịch hẹn</p></ProtectedRoute>} />
    <Route path="/login" element={<LoginProbe />} />
  </Routes></MemoryRouter>);
  expect(screen.getByTestId("login").textContent).toBe(`/login?next=${encodeURIComponent("/appointments?tab=past")}`);
});

it("renders the page when a token is present", () => {
  localStorage.setItem("token", "x.y.z");
  render(<MemoryRouter initialEntries={["/appointments"]}><Routes>
    <Route path="/appointments" element={<ProtectedRoute><p>Lịch hẹn</p></ProtectedRoute>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText("Lịch hẹn")).toBeTruthy();
});
