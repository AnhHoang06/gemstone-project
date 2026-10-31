// Store-time helpers. The showroom runs on Asia/Ho_Chi_Minh (UTC+7, no daylight saving), and the API
// sends wall-clock values without an offset ("2026-11-03T09:00:00"). Wall-clock values are represented
// here as Date objects whose UTC fields equal the store wall clock, so no browser time zone leaks in.
const STORE_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS_LONG = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const BOOKING_WINDOW_DAYS = 60;
export const CANCEL_LIMIT_MS = 2 * 60 * 60 * 1000;

const pad = value => String(value).padStart(2, "0");

/** Current store wall clock (UTC fields = store time). */
export function storeNow(now = Date.now()) { return new Date(now + STORE_OFFSET_MS); }

/** "yyyy-MM-dd" for a store-wall-clock Date. */
export function toIsoDate(date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }

export function storeToday(now = Date.now()) { return toIsoDate(storeNow(now)); }

export function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

export function addDays(iso, days) { return toIsoDate(new Date(parseIsoDate(iso).getTime() + days * DAY_MS)); }

export function daysBetween(fromIso, toIso) { return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / DAY_MS); }

/** Parses an API wall-clock value ("2026-11-03T09:00:00", optional fraction, no offset) to UTC-coded ms. */
export function parseWallClock(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || "");
  if (!match) return NaN;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s || 0);
}

export function wallClockParts(value) {
  const ms = parseWallClock(value);
  if (Number.isNaN(ms)) return null;
  const date = new Date(ms);
  return { date: toIsoDate(date), time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`, weekday: date.getUTCDay(), ms };
}

/** Trims "09:00:00" to "09:00". */
export function shortTime(value) { return /^\d{1,2}:\d{2}/.test(value || "") ? value.slice(0, value.indexOf(":") + 3).padStart(5, "0") : value || ""; }

export function minutesOf(time) { const [h, m] = shortTime(time).split(":").map(Number); return h * 60 + m; }

export function formatDate(iso, { weekday = true } = {}) {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const text = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  return weekday ? `${WEEKDAYS_LONG[date.getUTCDay()]}, ${text}` : text;
}

export function formatMonth(year, month) { return `Tháng ${month + 1}/${year}`; }

export function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

export function formatPriceOrFree(price, formatPrice) { return Number(price) > 0 ? formatPrice(price) : "Miễn phí"; }

/** True when an appointment can still be cancelled by its customer (Pending/Confirmed, ≥ 2 hours ahead). */
export function canCustomerCancel(appointment, now = Date.now()) {
  if (!["Pending", "Confirmed"].includes(appointment.status)) return false;
  if (typeof appointment.canCancel === "boolean") return appointment.canCancel;
  return parseWallClock(appointment.startAt) - storeNow(now).getTime() >= CANCEL_LIMIT_MS;
}

export function isUpcoming(appointment, now = Date.now()) {
  if (!["Pending", "Confirmed"].includes(appointment.status)) return false;
  if (typeof appointment.isUpcoming === "boolean") return appointment.isUpcoming;
  return parseWallClock(appointment.endAt || appointment.startAt) > storeNow(now).getTime();
}

/** Mirrors the API's phone rule: optional +, digits with spaces/dots/dashes, 8–15 digits. */
export function isValidPhone(value) {
  const phone = value.trim();
  const digits = (phone.match(/\d/g) || []).length;
  return phone.length <= 20 && /^\+?\d[\d .-]{6,18}\d$/.test(phone) && digits >= 8 && digits <= 15;
}

const icsText = value => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, match => `\\${match}`);
const icsUtc = wallMs => {
  const d = new Date(wallMs - STORE_OFFSET_MS);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

/** RFC 5545 calendar file for one appointment. Times are emitted in UTC (store time − 7h). */
export function buildIcs(appointment, { now = Date.now(), origin = "" } = {}) {
  const start = parseWallClock(appointment.startAt);
  const end = Number.isNaN(parseWallClock(appointment.endAt)) ? start + 60 * 60 * 1000 : parseWallClock(appointment.endAt);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gem Aurelia//Dat lich tu van//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appointment-${appointment.id}@gem-aurelia`,
    `DTSTAMP:${icsUtc(now + STORE_OFFSET_MS)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsText(`Gem Aurelia · ${appointment.serviceName || "Tư vấn"}`)}`,
    `DESCRIPTION:${icsText(`Mã lịch hẹn #${appointment.id}. Trạng thái ban đầu: Chờ xác nhận.${origin ? ` Xem lịch hẹn: ${origin}/appointments` : ""}`)}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadIcs(appointment) {
  const blob = new Blob([buildIcs(appointment, { origin: window.location.origin })], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `gem-aurelia-lich-hen-${appointment.id}.ics`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
