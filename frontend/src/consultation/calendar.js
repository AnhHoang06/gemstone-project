import { parseIsoDate, toIsoDate } from "./time";

export const monthKey = iso => iso.slice(0, 7);
export const monthStart = (year, month) => toIsoDate(new Date(Date.UTC(year, month, 1)));
export const monthEnd = (year, month) => toIsoDate(new Date(Date.UTC(year, month + 1, 0)));

/** Classifies a date for the calendar: available | full | closed | past | outside | loading. */
export function dayState(iso, { minDate, maxDate, days, loading }) {
  if (iso < minDate) return { kind: "past", label: "đã qua" };
  if (iso > maxDate) return { kind: "outside", label: "chưa mở nhận lịch" };
  const day = days[iso];
  if (!day) return loading ? { kind: "loading", label: "đang tải" } : { kind: "closed", label: "không nhận lịch" };
  if (!day.isOpen) return { kind: "closed", label: day.reason ? `đóng cửa: ${day.reason}` : "đóng cửa" };
  if (!day.slots.length) return { kind: "closed", label: "không còn giờ nhận lịch" };
  return day.slots.some(slot => slot.remaining > 0) ? { kind: "available", label: "còn chỗ" } : { kind: "full", label: "hết chỗ" };
}

export function ymOf(iso) { const d = parseIsoDate(iso); return [d.getUTCFullYear(), d.getUTCMonth()]; }
export function ymObject(iso) { const [year, month] = ymOf(iso); return { year, month }; }
export function shiftMonth({ year, month }, delta) { const d = new Date(Date.UTC(year, month + delta, 1)); return { year: d.getUTCFullYear(), month: d.getUTCMonth() }; }
export function viewOf(iso) { return ymObject(iso); }
