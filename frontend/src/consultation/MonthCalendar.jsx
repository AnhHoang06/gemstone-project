import { useEffect, useId, useRef, useState } from "react";
import { ArrowIcon } from "./icons";
import { addDays, formatDate, formatMonth, parseIsoDate, toIsoDate, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "./time";
import { dayState, monthEnd, monthKey, monthStart, shiftMonth, ymObject, ymOf } from "./calendar";

export default function MonthCalendar({ view, onViewChange, minDate, maxDate, days, loading, selected, onSelect, today, disabled = false }) {
  const titleId = useId();
  const gridRef = useRef(null);
  const pendingFocus = useRef(false);
  const [focusDate, setFocusDate] = useState(null);
  const { year, month } = view;
  const first = monthStart(year, month), last = monthEnd(year, month);
  const canPrev = monthKey(first) > monthKey(minDate);
  const canNext = monthKey(first) < monthKey(maxDate);
  const context = { minDate, maxDate, days, loading };

  const inView = iso => iso && monthKey(iso) === monthKey(first);
  const fallbackFocus = () => {
    if (inView(selected)) return selected;
    for (let iso = first; iso <= last; iso = addDays(iso, 1)) if (dayState(iso, context).kind === "available") return iso;
    return minDate > first && minDate <= last ? minDate : first;
  };
  const activeDate = inView(focusDate) ? focusDate : fallbackFocus();

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current?.querySelector(`[data-date="${activeDate}"]`)?.focus();
  }, [activeDate]);

  function moveFocus(target) {
    const lower = monthStart(...ymOf(minDate)), upper = monthEnd(...ymOf(maxDate));
    const next = target < lower ? lower : target > upper ? upper : target;
    pendingFocus.current = true;
    setFocusDate(next);
    if (!inView(next)) onViewChange(ymObject(next));
    else if (next === activeDate) gridRef.current?.querySelector(`[data-date="${next}"]`)?.focus();
  }

  function onKeyDown(event, iso) {
    const date = parseIsoDate(iso), weekday = (date.getUTCDay() + 6) % 7;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (event.key in offsets) { event.preventDefault(); moveFocus(addDays(iso, offsets[event.key])); return; }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const delta = event.key === "PageUp" ? -1 : 1;
      const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
      moveFocus(toIsoDate(target));
    }
  }

  const leading = (parseIsoDate(first).getUTCDay() + 6) % 7;
  const cells = [...Array(leading).fill(null)];
  for (let iso = first; iso <= last; iso = addDays(iso, 1)) cells.push(iso);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return <div className="month-calendar" aria-busy={loading}>
    <div className="month-calendar__header">
      <button type="button" className="month-calendar__nav" aria-label="Tháng trước" disabled={!canPrev}
        onClick={() => onViewChange(shiftMonth(view, -1))}><ArrowIcon direction="left" /></button>
      <h3 id={titleId} aria-live="polite">{formatMonth(year, month)}</h3>
      <button type="button" className="month-calendar__nav" aria-label="Tháng sau" disabled={!canNext}
        onClick={() => onViewChange(shiftMonth(view, 1))}><ArrowIcon /></button>
    </div>
    <table role="grid" ref={gridRef} aria-labelledby={titleId} className="month-calendar__grid">
      <thead><tr>{[1, 2, 3, 4, 5, 6, 0].map(day => <th key={day} scope="col" abbr={WEEKDAYS_LONG[day]}>{WEEKDAYS_SHORT[day]}</th>)}</tr></thead>
      <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((iso, column) => {
        if (!iso) return <td key={`empty-${column}`} role="presentation" />;
        const state = dayState(iso, context);
        const usable = state.kind === "available" && !disabled;
        const isSelected = iso === selected;
        return <td key={iso} aria-selected={isSelected}>
          <button type="button" data-date={iso} tabIndex={iso === activeDate ? 0 : -1}
            className={`month-day month-day--${state.kind}${isSelected ? " is-selected" : ""}${iso === today ? " is-today" : ""}`}
            aria-disabled={!usable} aria-current={iso === today ? "date" : undefined}
            aria-label={`${formatDate(iso)}, ${state.label}${iso === today ? ", hôm nay" : ""}`}
            title={state.kind === "closed" && days[iso]?.reason ? days[iso].reason : undefined}
            onFocus={() => setFocusDate(iso)}
            onKeyDown={event => onKeyDown(event, iso)}
            onClick={() => { if (usable) onSelect(iso); }}>
            <span aria-hidden="true">{parseIsoDate(iso).getUTCDate()}</span>
          </button>
        </td>;
      })}</tr>)}</tbody>
    </table>
    <p className="month-calendar__legend"><span className="legend-item"><span className="legend-dot" aria-hidden="true" /> Còn khung giờ trống</span>
      <span className="legend-item"><span className="legend-strike" aria-hidden="true">12</span> Đóng cửa, hết chỗ hoặc đã qua</span></p>
  </div>;
}
