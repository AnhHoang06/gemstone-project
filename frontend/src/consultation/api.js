// Every consultation endpoint and response normalizer lives here so contract changes stay in one file.
// Contract: /home/claude/gemstone-run/consult-chat-api.md (spec section 2).
import api from "../api/api";
import { shortTime } from "./time";

export const APPOINTMENT_HUB_PATH = "/hubs/orders";
export const APPOINTMENT_EVENT = "AppointmentChanged";

const list = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
};

export function normalizeService(service) {
  return { ...service, price: Number(service.price) || 0, durationMinutes: Number(service.durationMinutes) || 0,
    isActive: service.isActive !== false, sortOrder: Number(service.sortOrder) || 0 };
}

export function normalizeDay(day) {
  return { date: String(day.date).slice(0, 10), isOpen: day.isOpen !== false, reason: day.reason || "",
    slots: list(day.slots).map(slot => ({ start: shortTime(slot.start), end: shortTime(slot.end), remaining: Number(slot.remaining) || 0 })) };
}

export function normalizeHour(row) {
  return { dayOfWeek: Number(row.dayOfWeek), isOpen: Boolean(row.isOpen), openTime: shortTime(row.openTime) || "09:00",
    closeTime: shortTime(row.closeTime) || "18:00", slotMinutes: Number(row.slotMinutes) || 60, capacityPerSlot: Number(row.capacityPerSlot) || 1 };
}

export function affectedAppointments(error) {
  const data = error?.response?.data;
  return list(data, "affectedAppointments", "appointments", "affected");
}

export const consultationApi = {
  services: () => api.get("/consultation/services").then(({ data }) => list(data, "items").map(normalizeService)
    .filter(service => service.isActive).sort((a, b) => a.sortOrder - b.sortOrder)),
  availability: (serviceId, from, days) => api.get("/consultation/availability", { params: { serviceId, from, days } })
    .then(({ data }) => list(data, "days").map(normalizeDay)),

  myAppointments: () => api.get("/appointments").then(({ data }) => list(data, "items")),
  book: request => api.post("/appointments", request).then(({ data }) => data),
  cancelMine: (id, reason) => api.put(`/appointments/${id}/cancel`, { reason: reason || null }).then(({ data }) => data),

  adminAppointments: params => api.get("/admin/appointments", { params }).then(({ data }) => list(data, "items")),
  setStatus: (id, status, reason) => api.put(`/admin/appointments/${id}/status`, { status, reason: reason || null }).then(({ data }) => data),

  adminServices: () => api.get("/admin/consultation/services").then(({ data }) => list(data, "items").map(normalizeService)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)),
  createService: body => api.post("/admin/consultation/services", body).then(({ data }) => data),
  updateService: (id, body) => api.put(`/admin/consultation/services/${id}`, body).then(({ data }) => data),
  deleteService: id => api.delete(`/admin/consultation/services/${id}`).then(({ data }) => data),

  adminHours: () => api.get("/admin/consultation/hours").then(({ data }) => list(data, "days", "hours", "weekly").map(normalizeHour)),
  saveHours: (days, force) => api.put("/admin/consultation/hours", {
    days: days.map(day => ({ ...day, openTime: `${shortTime(day.openTime)}:00`, closeTime: `${shortTime(day.closeTime)}:00` })),
  }, { params: force ? { force: true } : undefined }).then(({ data }) => data),

  closedDates: () => api.get("/admin/consultation/closed-dates").then(({ data }) => list(data, "items")
    .map(row => ({ date: String(row.date).slice(0, 10), reason: row.reason || "" }))),
  addClosedDate: (body, force) => api.post("/admin/consultation/closed-dates", body, { params: force ? { force: true } : undefined }).then(({ data }) => data),
  removeClosedDate: date => api.delete(`/admin/consultation/closed-dates/${date}`).then(({ data }) => data),
};
