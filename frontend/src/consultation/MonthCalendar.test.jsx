import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MonthCalendar from "./MonthCalendar";
import { addDays } from "./time";

const open = date => ({ date, isOpen: true, slots: [{ start: "09:00", end: "10:00", remaining: 1 }] });
function buildDays(from, to) {
  const days = {};
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) days[iso] = open(iso);
  days["2026-11-08"] = { date: "2026-11-08", isOpen: false, reason: "Nghỉ lễ", slots: [] };
  days["2026-11-09"] = { date: "2026-11-09", isOpen: true, slots: [{ start: "09:00", end: "10:00", remaining: 0 }] };
  return days;
}

function Harness({ onSelect }) {
  const [view, setView] = useState({ year: 2026, month: 10 });
  const [selected, setSelected] = useState(null);
  return <MonthCalendar view={view} onViewChange={setView} minDate="2026-11-05" maxDate="2026-12-31" today="2026-11-05"
    days={buildDays("2026-11-05", "2026-12-31")} loading={false} selected={selected}
    onSelect={iso => { setSelected(iso); onSelect(iso); }} />;
}
const day = label => screen.getByRole("button", { name: new RegExp(`^${label}`) });

afterEach(cleanup);

describe("MonthCalendar", () => {
  it("starts weeks on Monday and disables past, closed and full days", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    expect(screen.getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
    expect(screen.getByRole("grid", { name: "Tháng 11/2026" })).toBeTruthy();
    for (const label of ["Thứ Tư, 04/11/2026, đã qua", "Chủ Nhật, 08/11/2026, đóng cửa: Nghỉ lễ", "Thứ Hai, 09/11/2026, hết chỗ"]) {
      const button = day(label);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(day("Thứ Năm, 05/11/2026, còn chỗ, hôm nay").getAttribute("aria-current")).toBe("date");
    expect(screen.getByRole("button", { name: "Tháng trước" }).disabled).toBe(true);
  });

  it("moves focus with arrow keys across weeks and months and selects with Enter", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const first = day("Thứ Năm, 05/11/2026");
    expect(first.tabIndex).toBe(0);
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(day("Thứ Sáu, 06/11/2026"));
    fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(day("Thứ Sáu, 13/11/2026"));
    expect(document.activeElement.tabIndex).toBe(0);
    fireEvent.keyDown(document.activeElement, { key: "Home" });
    expect(document.activeElement).toBe(day("Thứ Hai, 09/11/2026"));
    fireEvent.keyDown(document.activeElement, { key: "ArrowUp" });
    expect(document.activeElement).toBe(day("Thứ Hai, 02/11/2026, đã qua"));
    // Enter on a disabled day does nothing; on an available day it selects.
    fireEvent.click(document.activeElement);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement, { key: "PageDown" });
    expect(screen.getByRole("grid", { name: "Tháng 12/2026" })).toBeTruthy();
    expect(document.activeElement).toBe(day("Thứ Tư, 02/12/2026"));
    fireEvent.keyDown(document.activeElement, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement, { key: "ArrowLeft" });
    expect(screen.getByRole("grid", { name: "Tháng 11/2026" })).toBeTruthy();
    expect(document.activeElement).toBe(day("Thứ Hai, 30/11/2026"));
    fireEvent.click(document.activeElement); // Enter/Space on a native button dispatch click
    expect(onSelect).toHaveBeenCalledWith("2026-11-30");
    expect(document.activeElement.closest("td").getAttribute("aria-selected")).toBe("true");
  });

  it("limits month navigation to the booking window", () => {
    render(<Harness onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tháng sau" }));
    expect(screen.getByRole("grid", { name: "Tháng 12/2026" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tháng sau" }).disabled).toBe(true);
    const end = day("Thứ Năm, 31/12/2026");
    act(() => end.focus());
    fireEvent.keyDown(end, { key: "ArrowRight" });
    expect(document.activeElement).toBe(end);
  });
});
