import { STORE_TIME_ZONE } from "./chatModel";

export const WEEK = [[1, "Thứ Hai"], [2, "Thứ Ba"], [3, "Thứ Tư"], [4, "Thứ Năm"], [5, "Thứ Sáu"], [6, "Thứ Bảy"], [0, "Chủ Nhật"]];
export const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const hhmm = value => String(value ?? "").slice(0, 5);

// "Now" in the showroom's time zone, independent of the visitor's device.
export function storeNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: STORE_TIME_ZONE, weekday: "short", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(part => [part.type, part.value]));
  return { day: WEEKDAY_INDEX[parts.weekday], date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function normalizeHours(data) {
  const list = Array.isArray(data) ? data : data?.days ?? data?.week ?? data?.hours ?? [];
  const days = new Map(list.map(day => [Number(day.dayOfWeek), { isOpen: Boolean(day.isOpen), open: hhmm(day.openTime), close: hhmm(day.closeTime) }]));
  const closed = (Array.isArray(data) ? [] : data?.closedDates ?? data?.upcomingClosedDates ?? [])
    .map(item => ({ date: String(item.date ?? item).slice(0, 10), reason: item.reason ?? "" }));
  return { days, closed };
}

export const formatDate = date => { const [year, month, day] = date.split("-"); return `${day}/${month}/${year}`; };

