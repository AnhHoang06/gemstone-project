// Local development/test DB only. Never target a shared production database.
// Creates its own users/services/appointments/closed dates (tagged), temporarily replaces the weekly hours
// with a known test schedule and restores the exact original rows in `finally`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
const env = name => process.env[`CONSULT_${name}`] || process.env[`PERSON3_${name}`];
const base = env('API_URL') || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const sqlArgs = ['-S', env('SQL_SERVER') || '.\\SQLEXPRESS', '-d', env('SQL_DATABASE') || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W'];
const sql = query => execFileSync('sqlcmd', [...sqlArgs, '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
const script = fileURLToPath(new URL('../backend/GemstoneShop/GemstoneShop/Database/Consultation.sql', import.meta.url));
const tag = `consult-${randomUUID().replaceAll('-', '')}`;
const users = [], services = [], connections = [];
let hoursSnapshot = null;

async function call(token, method, path, body) {
  const res = await fetch(`${base}/api${path}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: res.status, data };
}
function expect(response, status) { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; }
async function user(admin = false) {
  const email = `${tag}-${users.length}@example.invalid`, password = `${randomUUID()}!aA9`;
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email, password }), 200);
  const id = scalar(`SELECT Id FROM Users WHERE Email='${email}'`); users.push(id);
  if (admin) sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
  return { id, email, ...expect(await call(null, 'POST', '/auth/login', { email, password }), 200) };
}
const pass = message => console.log(`PASS: ${message}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) { for (let i = 0; i < 50; i++) { if (predicate()) return; await sleep(100); } assert.fail(`Realtime timeout: ${label}`); }
const storeFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const storeTime = (offsetMs = 0) => storeFormat.format(new Date(Date.now() + offsetMs)).replace(',', ''); // "yyyy-MM-dd HH:mm:ss"
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
const testWeek = (overrides = {}) => Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, openTime: '09:00', closeTime: '17:00', slotMinutes: 60, capacityPerSlot: 2, ...(overrides[d] || {}) }));
const book = (u, serviceId, date, start, extra = {}) => call(u.token, 'POST', '/appointments',
  { requestId: randomUUID(), serviceId, date, start, contactName: 'Khách kiểm thử', phone: '0900000000', note: tag, ...extra });
async function hub(path, u, names) {
  const events = [];
  const connection = new HubConnectionBuilder().withUrl(`${base}${path}`, { accessTokenFactory: () => u.token, transport: HttpTransportType.WebSockets })
    .configureLogging(LogLevel.None).build();
  for (const name of names) connection.on(name, data => events.push({ name, ...data }));
  connections.push(connection); await connection.start();
  return events;
}

try {
  // Snapshot the exact weekly-hours rows so they can be restored verbatim.
  hoursSnapshot = sql(`SELECT STRING_AGG(CONCAT(DayOfWeek,',',CAST(IsOpen AS int),',',CONVERT(varchar(8),OpenTime,108),',',CONVERT(varchar(8),CloseTime,108),',',SlotMinutes,',',CapacityPerSlot),';') FROM ConsultationHours`);
  if (hoursSnapshot === 'NULL') hoursSnapshot = '';
  const admin = await user(true);
  const customers = [];
  for (let i = 0; i < 10; i++) customers.push(await user());
  const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = customers;

  // ── Admin service CRUD + validation ────────────────────────────────────────
  const mkService = async (suffix, durationMinutes, price = 0) => {
    const s = expect(await call(admin.token, 'POST', '/admin/consultation/services', { name: `${tag}-${suffix}`, description: 'Dịch vụ kiểm thử', price, durationMinutes, isActive: true, sortOrder: 9000 }), 201);
    services.push(s.id); return s;
  };
  const s60 = await mkService('60', 60), s120 = await mkService('120', 120, 500000), spare = await mkService('spare', 30);
  expect(await call(admin.token, 'POST', '/admin/consultation/services', { name: `${tag}-60`, price: 0, durationMinutes: 60 }), 409);
  expect(await call(admin.token, 'POST', '/admin/consultation/services', { name: `${tag}-x`, price: 0, durationMinutes: 10 }), 400);
  expect(await call(admin.token, 'POST', '/admin/consultation/services', { name: `${tag}-x`, price: -1, durationMinutes: 60 }), 400);
  expect(await call(admin.token, 'POST', '/admin/consultation/services', { name: ' ', price: 0, durationMinutes: 60 }), 400);
  expect(await call(c1.token, 'POST', '/admin/consultation/services', { name: `${tag}-x`, price: 0, durationMinutes: 60 }), 403);
  expect(await call(null, 'GET', '/admin/consultation/services'), 401);
  const updated = expect(await call(admin.token, 'PUT', `/admin/consultation/services/${spare.id}`, { name: `${tag}-spare`, price: 100000, durationMinutes: 45, sortOrder: 9001 }), 200);
  assert.equal(updated.durationMinutes, 45); assert.equal(updated.isActive, true);
  expect(await call(admin.token, 'PUT', '/admin/consultation/services/2147483647', { name: `${tag}-y`, price: 0, durationMinutes: 60 }), 404);
  const publicServices = expect(await call(null, 'GET', '/consultation/services'), 200);
  assert.ok(publicServices.some(s => s.id === s60.id && s.isFree === true));
  assert.ok(publicServices.some(s => s.id === s120.id && s.price === 500000 && s.isFree === false));
  pass('Admin service CRUD validates name/duration/price, rejects duplicates, 401/403 for non-admins; public list shows active services');

  // ── Known weekly schedule for the duration of the test ─────────────────────
  expect(await call(c1.token, 'PUT', '/admin/consultation/hours', { days: testWeek() }), 403);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: testWeek().slice(0, 6) }), 400);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: testWeek({ 2: { openTime: '17:00', closeTime: '09:00' } }) }), 400);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: testWeek({ 2: { capacityPerSlot: 21 } }) }), 400);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours?force=true', { days: testWeek() }), 200);
  const hours = expect(await call(null, 'GET', '/consultation/hours'), 200);
  assert.equal(hours.days.length, 7); assert.ok(hours.days.every(d => d.isOpen && d.openTime === '09:00' && d.closeTime === '17:00'));

  // ── Availability ───────────────────────────────────────────────────────────
  const availability = async (serviceId, from, days = 1) => expect(await call(null, 'GET', `/consultation/availability?serviceId=${serviceId}&from=${from}&days=${days}`), 200);
  const probe = await availability(s60.id, storeTime().slice(0, 10));
  const today = probe.today, last = probe.lastBookableDate;
  assert.equal(today, storeTime().slice(0, 10)); assert.equal(last, addDays(today, 60));
  const earliest = storeTime(2 * 3600e3).slice(0, 16);
  probe.days[0].slots.forEach(s => assert.ok(`${today} ${s.start}` >= earliest, `slot ${s.start} is less than 2h ahead`));
  assert.deepEqual((await availability(s60.id, addDays(today, -1))).days[0].slots, []);
  const edge = await availability(s60.id, last, 2);
  assert.ok(edge.days[0].slots.length > 0); assert.equal(edge.days[1].date, addDays(last, 1)); assert.deepEqual(edge.days[1].slots, []);
  expect(await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}&from=${addDays(last, 1)}`), 400);
  expect(await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}&days=0`), 400);
  expect(await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}&days=43`), 400);
  expect(await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}&from=31-12-2026`), 400);
  expect(await call(null, 'GET', '/consultation/availability'), 400);
  expect(await call(null, 'GET', '/consultation/availability?serviceId=2147483647'), 404);
  expect((await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}&days=42`)), 200);

  // Two clean consecutive days (no closed date, no existing bookings) for deterministic counts.
  let D;
  for (let k = 21; k < 50 && !D; k++) {
    const pair = await availability(s60.id, addDays(today, k), 2);
    if (pair.days.every(d => d.isOpen && d.slots.length === 8 && d.slots.every(s => s.remaining === 2))) D = addDays(today, k);
  }
  assert.ok(D, 'No clean test day found');
  const D1 = addDays(D, 1);
  const day = await availability(s60.id, D);
  assert.deepEqual(day.days[0].slots.map(s => s.start), ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
  assert.equal(day.days[0].slots[0].end, '10:00');
  const long = await availability(s120.id, D);
  assert.deepEqual(long.days[0].slots.map(s => s.start), ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']);
  assert.equal(long.days[0].slots.at(-1).end, '17:00');
  pass('Availability: 2-hour lead, 60-day horizon, range validation, slot grid and multi-slot service end times');

  // ── Booking validation / auth ──────────────────────────────────────────────
  expect(await call(null, 'POST', '/appointments', { requestId: randomUUID(), serviceId: s60.id, date: D, start: '09:00', contactName: 'x', phone: '0900000000' }), 401);
  expect(await book(c1, s60.id, D, '09:00', { requestId: undefined }), 400);
  expect(await book(c1, s60.id, D, '09:00', { phone: 'abc' }), 400);
  expect(await book(c1, s60.id, D, '09:00', { contactName: '  ' }), 400);
  expect(await book(c1, s60.id, D, '9h'), 400);
  expect(await book(c1, s60.id, 'tomorrow', '09:00'), 400);
  expect(await book(c1, 2147483647, D, '09:00'), 404);
  assert.equal(expect(await book(c1, s60.id, D, '09:30'), 409).code, 'slot_unavailable');
  assert.equal(expect(await book(c1, s60.id, today, '08:00'), 409).code, 'slot_unavailable');
  assert.equal(expect(await book(c1, s60.id, addDays(last, 1), '09:00'), 409).code, 'slot_unavailable');
  pass('Booking requires login and validates request id, contact, phone, date/time, service and slot grid');

  // ── Realtime listeners ─────────────────────────────────────────────────────
  const c7Orders = await hub('/hubs/orders', c7, ['AppointmentChanged']);
  const c2Orders = await hub('/hubs/orders', c2, ['AppointmentChanged']);
  const adminChat = await hub('/hubs/chat', admin, ['AppointmentChanged']);

  // ── Concurrency: capacity 2, five simultaneous customers ───────────────────
  const race = await Promise.all([c1, c2, c3, c4, c5].map(u => book(u, s60.id, D, '10:00')));
  const ok = race.filter(r => r.status === 201), full = race.filter(r => r.status === 409);
  assert.equal(ok.length, 2, JSON.stringify(race.map(r => r.status))); assert.equal(full.length, 3);
  full.forEach(r => assert.equal(r.data.code, 'slot_full'));
  assert.equal(scalar(`SELECT COUNT(*) FROM Appointments WHERE ServiceId=${s60.id} AND StartAt='${D}T10:00:00'`), 2);
  assert.equal((await availability(s60.id, D)).days[0].slots.find(s => s.start === '10:00').remaining, 0);
  ok.forEach(r => { assert.equal(r.data.status, 'Pending'); assert.equal(r.data.serviceName, `${tag}-60`); assert.equal(r.data.price, 0); assert.equal(r.data.replayed, false); assert.equal(r.data.canCancel, true); });
  pass('Concurrent bookings on one slot: exactly capacity (2) succeed, the rest get 409 slot_full');

  // ── Idempotency by (UserId, RequestId) ─────────────────────────────────────
  const replayBody = { requestId: randomUUID(), serviceId: s120.id, date: D, start: '13:00', contactName: 'Khách kiểm thử', phone: '0900000000', note: tag };
  const replays = await Promise.all(Array.from({ length: 4 }, () => call(c6.token, 'POST', '/appointments', replayBody)));
  replays.forEach(r => assert.ok([200, 201].includes(r.status), JSON.stringify(r.data)));
  assert.equal(new Set(replays.map(r => r.data.id)).size, 1);
  assert.equal(replays.filter(r => r.status === 201).length, 1);
  assert.equal(scalar(`SELECT COUNT(*) FROM Appointments WHERE UserId=${c6.id}`), 1);
  const again = expect(await call(c6.token, 'POST', '/appointments', replayBody), 200);
  assert.equal(again.replayed, true); assert.equal(again.id, replays[0].data.id);
  assert.equal(expect(await call(c6.token, 'POST', '/appointments', { ...replayBody, note: 'khác' }), 409).code, 'request_mismatch');
  pass('Same requestId + same body replays the original appointment (no duplicates under concurrency); different body → 409 request_mismatch');

  // ── Multi-slot service occupies consecutive slots ──────────────────────────
  // c6 holds s120 at 13:00 (13:00 + 14:00 slots).
  let s60Day = (await availability(s60.id, D)).days[0].slots;
  assert.deepEqual(['12:00', '13:00', '14:00', '15:00'].map(t => s60Day.find(s => s.start === t).remaining), [2, 1, 1, 2]);
  let s120Day = (await availability(s120.id, D)).days[0].slots;
  assert.deepEqual(['11:00', '12:00', '13:00', '14:00', '15:00'].map(t => s120Day.find(s => s.start === t).remaining), [2, 1, 1, 1, 2]);
  const c8Long = expect(await book(c8, s120.id, D, '12:00'), 201); // 12:00 + 13:00
  s60Day = (await availability(s60.id, D)).days[0].slots;
  assert.deepEqual(['12:00', '13:00', '14:00'].map(t => s60Day.find(s => s.start === t).remaining), [1, 0, 1]);
  s120Day = (await availability(s120.id, D)).days[0].slots;
  assert.equal(s120Day.find(s => s.start === '12:00').remaining, 0); // 13:00 slot is full
  assert.equal(expect(await book(c9, s60.id, D, '13:00'), 409).code, 'slot_full');
  assert.equal(expect(await book(c9, s120.id, D, '12:00'), 409).code, 'slot_full');
  pass('Services longer than SlotMinutes occupy every overlapped slot; remaining is the minimum across them');

  // ── Per-customer limit (3 upcoming) and own-overlap ───────────────────────
  const c7a = expect(await book(c7, s60.id, D1, '09:00'), 201);
  await until(() => c7Orders.some(e => e.appointmentId === c7a.id) && adminChat.some(e => e.appointmentId === c7a.id), 'AppointmentChanged on create');
  assert.ok(!c2Orders.some(e => e.appointmentId === c7a.id));
  const c7b = expect(await book(c7, s60.id, D1, '11:00'), 201);
  expect(await book(c7, s60.id, D1, '14:00'), 201);
  assert.equal(expect(await book(c7, s60.id, D1, '16:00'), 409).code, 'limit_reached');
  expect(await book(c8, s120.id, D1, '09:00'), 201);
  assert.equal(expect(await book(c8, s60.id, D1, '10:00'), 409).code, 'overlap');
  pass('At most 3 upcoming Pending/Confirmed appointments per customer; own overlapping bookings are rejected; owner + admin get AppointmentChanged, others do not');

  // ── Ownership and listing ──────────────────────────────────────────────────
  expect(await call(c2.token, 'GET', `/appointments/${c7a.id}`), 404);
  expect(await call(c2.token, 'PUT', `/appointments/${c7a.id}/cancel`, {}), 404);
  expect(await call(c2.token, 'GET', '/admin/appointments'), 403);
  expect(await call(c2.token, 'PUT', `/admin/appointments/${c7a.id}/status`, { status: 'Confirmed' }), 403);
  expect(await call(null, 'GET', '/appointments'), 401);
  const mine = expect(await call(c7.token, 'GET', '/appointments'), 200);
  assert.deepEqual(mine.map(a => a.start), ['09:00', '11:00', '14:00']);
  assert.ok(mine.every(a => a.isUpcoming && a.date === D1));
  assert.equal(expect(await call(c7.token, 'GET', `/appointments/${c7a.id}`), 200).id, c7a.id);
  pass('Customers only see and cancel their own appointments (404 otherwise); admin endpoints 403 for customers');

  // ── Customer cancellation (≥ 2 hours before) ──────────────────────────────
  const cancelled = expect(await call(c7.token, 'PUT', `/appointments/${c7a.id}/cancel`, { reason: 'Bận việc' }), 200);
  assert.equal(cancelled.status, 'Cancelled'); assert.equal(cancelled.cancelledBy, 'Customer'); assert.equal(cancelled.cancelReason, 'Bận việc');
  assert.equal(expect(await call(c7.token, 'PUT', `/appointments/${c7a.id}/cancel`, {}), 200).status, 'Cancelled');
  expect(await book(c7, s60.id, D1, '16:00'), 201); // limit freed by the cancellation
  const soonStart = storeTime(3600e3), soonEnd = storeTime(2 * 3600e3);
  const soonId = scalar(`INSERT INTO Appointments(UserId,ServiceId,ServiceName,Price,StartAt,EndAt,Status,ContactName,Phone,Note,RequestId,CreatedAt)
    OUTPUT INSERTED.Id VALUES(${c9.id},${s60.id},N'${tag}-60',0,'${soonStart}','${soonEnd}','Pending',N'${tag}','0900000000',N'${tag}',NEWID(),SYSUTCDATETIME())`);
  const soon = expect(await call(c9.token, 'GET', `/appointments/${soonId}`), 200);
  assert.equal(soon.canCancel, false);
  assert.equal(expect(await call(c9.token, 'PUT', `/appointments/${soonId}/cancel`, {}), 409).code, 'too_late');
  expect(await call(c7.token, 'PUT', `/appointments/${c7b.id}/cancel`, { reason: 'x'.repeat(301) }), 400);
  pass('Customers can cancel Pending/Confirmed ≥ 2h ahead (idempotent); within 2h → 409 too_late');

  // ── Admin status transitions (compare-and-set) ─────────────────────────────
  const pendingId = ok[1].data.id;
  expect(await call(admin.token, 'PUT', `/admin/appointments/${pendingId}/status`, { status: 'Pending' }), 400);
  expect(await call(admin.token, 'PUT', `/admin/appointments/${pendingId}/status`, { status: 'Nope' }), 400);
  assert.equal(expect(await call(admin.token, 'PUT', `/admin/appointments/${pendingId}/status`, { status: 'Completed' }), 409).code, 'invalid_transition');
  const confirms = await Promise.all(Array.from({ length: 5 }, () => call(admin.token, 'PUT', `/admin/appointments/${pendingId}/status`, { status: 'Confirmed' })));
  confirms.forEach(r => assert.equal(expect(r, 200).status, 'Confirmed'));
  assert.equal(expect(await call(admin.token, 'PUT', `/admin/appointments/${pendingId}/status`, { status: 'Completed' }), 409).code, 'not_started');
  expect(await call(admin.token, 'PUT', '/admin/appointments/2147483647/status', { status: 'Confirmed' }), 404);
  expect(await call(admin.token, 'PUT', `/admin/appointments/${soonId}/status`, { status: 'Confirmed' }), 200);
  sql(`UPDATE Appointments SET StartAt=DATEADD(hour,-3,StartAt), EndAt=DATEADD(hour,-3,EndAt) WHERE Id=${soonId} AND Note=N'${tag}'`);
  assert.equal(expect(await call(admin.token, 'PUT', `/admin/appointments/${soonId}/status`, { status: 'NoShow' }), 200).status, 'NoShow');
  assert.equal(expect(await call(admin.token, 'PUT', `/admin/appointments/${soonId}/status`, { status: 'Cancelled' }), 409).code, 'invalid_transition');
  const staffCancel = expect(await call(admin.token, 'PUT', `/admin/appointments/${c7b.id}/status`, { status: 'Cancelled', reason: 'Cửa hàng bận' }), 200);
  assert.equal(staffCancel.cancelledBy, 'Staff'); assert.equal(staffCancel.customer.id, c7.id);
  await until(() => c7Orders.some(e => e.appointmentId === c7b.id), 'AppointmentChanged on staff cancel');
  const list = expect(await call(admin.token, 'GET', `/admin/appointments?from=${D}&to=${D1}&q=${tag}`), 200);
  assert.ok(list.items.length >= 8 && list.items.every(a => a.customer.fullName === tag));
  assert.ok(list.items.every((a, i, all) => i === 0 || all[i - 1].startAt <= a.startAt));
  const onlyCancelled = expect(await call(admin.token, 'GET', `/admin/appointments?from=${D}&to=${D1}&q=${tag}&status=Cancelled`), 200);
  assert.ok(onlyCancelled.items.length === 2 && onlyCancelled.items.every(a => a.status === 'Cancelled'));
  assert.equal(expect(await call(admin.token, 'GET', `/admin/appointments?q=${c7.email}&from=${D1}&to=${D1}`), 200).items.length, 4);
  expect(await call(admin.token, 'GET', `/admin/appointments?from=${D1}&to=${D}`), 400);
  expect(await call(admin.token, 'GET', '/admin/appointments?status=Unknown'), 400);
  pass('Admin transitions: Pending→Confirmed/Cancelled, Confirmed→Completed/NoShow/Cancelled only (CAS, idempotent), not before start; filters by date/status/name/email');

  // ── Closed dates ───────────────────────────────────────────────────────────
  const closedConflict = expect(await call(admin.token, 'POST', '/admin/consultation/closed-dates', { date: D, reason: tag }), 409);
  assert.equal(closedConflict.code, 'affects_appointments');
  assert.ok(closedConflict.appointments.some(a => a.id === c8Long.id));
  assert.equal(scalar(`SELECT COUNT(*) FROM ConsultationClosedDates WHERE Date='${D}'`), 0);
  expect(await call(admin.token, 'POST', '/admin/consultation/closed-dates', { date: addDays(today, -1), reason: tag }), 400);
  const D2 = addDays(D, 2);
  assert.equal((await availability(s60.id, D2)).days[0].isOpen, true);
  expect(await call(admin.token, 'POST', '/admin/consultation/closed-dates', { date: D2, reason: tag }), 201);
  const closedDay = (await availability(s60.id, D2)).days[0];
  assert.equal(closedDay.isOpen, false); assert.equal(closedDay.reason, tag); assert.deepEqual(closedDay.slots, []);
  assert.equal(expect(await book(c10, s60.id, D2, '09:00'), 409).code, 'slot_unavailable');
  assert.ok(expect(await call(null, 'GET', '/consultation/hours'), 200).closedDates.some(c => c.date === D2 && c.reason === tag));
  const forced = expect(await call(admin.token, 'POST', '/admin/consultation/closed-dates?force=true', { date: D, reason: tag }), 201);
  assert.ok(forced.affected.some(a => a.id === c8Long.id));
  assert.equal(scalar(`SELECT COUNT(*) FROM Appointments WHERE Id=${c8Long.id} AND Status='Pending'`), 1); // not auto-cancelled
  expect(await call(admin.token, 'DELETE', `/admin/consultation/closed-dates/${D}`), 204);
  expect(await call(admin.token, 'DELETE', `/admin/consultation/closed-dates/${D2}`), 204);
  expect(await call(admin.token, 'DELETE', `/admin/consultation/closed-dates/${D2}`), 404);
  pass('Closed dates hide availability and block booking; closing a day with bookings → 409 with the list unless force=true');

  // ── Hours change that would strand bookings ───────────────────────────────
  const shorter = testWeek({ [weekday(D)]: { closeTime: '12:00' } });
  const hoursConflict = expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: shorter }), 409);
  assert.equal(hoursConflict.code, 'affects_appointments');
  const affectedIds = hoursConflict.appointments.map(a => a.id);
  assert.ok(affectedIds.includes(c8Long.id) && affectedIds.includes(replays[0].data.id));
  assert.ok(!affectedIds.includes(ok[0].data.id)); // 10:00–11:00 still fits
  assert.equal(expect(await call(null, 'GET', '/consultation/hours'), 200).days[weekday(D)].closeTime, '17:00');
  const closedWeekday = testWeek({ [weekday(D1)]: { isOpen: false } });
  assert.ok(expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: closedWeekday }), 409).appointments.length >= 3);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: testWeek({ 3: { capacityPerSlot: 3 } }) }), 200);
  const forcedHours = expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: shorter, force: true }), 200);
  assert.ok(forcedHours.affected.some(a => a.id === c8Long.id));
  assert.deepEqual((await availability(s60.id, D)).days[0].slots.map(s => s.start), ['09:00', '10:00', '11:00']);
  expect(await call(admin.token, 'PUT', '/admin/consultation/hours', { days: testWeek() }), 200);
  pass('Changing hours that strands upcoming bookings → 409 with affected list (no change saved) unless force; harmless changes save directly');

  // ── Service delete = hide when it has bookings ────────────────────────────
  const hidden = expect(await call(admin.token, 'DELETE', `/admin/consultation/services/${s60.id}`), 200);
  assert.deepEqual([hidden.deleted, hidden.isActive], [false, false]);
  assert.ok(!expect(await call(null, 'GET', '/consultation/services'), 200).some(s => s.id === s60.id));
  expect(await call(null, 'GET', `/consultation/availability?serviceId=${s60.id}`), 404);
  assert.equal(expect(await book(c10, s60.id, D1, '12:00'), 409).code, 'service_unavailable');
  assert.ok(expect(await call(admin.token, 'GET', '/admin/consultation/services'), 200).some(s => s.id === s60.id && !s.isActive && s.appointmentCount > 0));
  assert.equal(expect(await call(admin.token, 'DELETE', `/admin/consultation/services/${spare.id}`), 200).deleted, true);
  assert.equal(scalar(`SELECT COUNT(*) FROM ConsultationServices WHERE Id=${spare.id}`), 0);
  expect(await call(admin.token, 'DELETE', `/admin/consultation/services/${spare.id}`), 404);
  pass('Deleting a service with appointments hides it (bookings keep snapshots); unused services are removed');

  // ── Schema: repeatable script and database constraints ────────────────────
  const before = scalar(`SELECT COUNT(*) FROM Appointments WHERE Note=N'${tag}'`);
  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  assert.equal(scalar(`SELECT COUNT(*) FROM Appointments WHERE Note=N'${tag}'`), before);
  const err = q => scalar(`BEGIN TRY ${q}; SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH`);
  const rid = sql(`SELECT CONVERT(varchar(36),RequestId) FROM Appointments WHERE Id=${c7a.id}`);
  assert.equal(err(`INSERT INTO Appointments(UserId,ServiceId,ServiceName,Price,StartAt,EndAt,Status,ContactName,Phone,RequestId) VALUES(${c7.id},${s120.id},N'x',0,'${D}T09:00:00','${D}T10:00:00','Pending',N'x','0900000000','${rid}')`), 2627);
  assert.equal(err(`INSERT INTO Appointments(UserId,ServiceId,ServiceName,Price,StartAt,EndAt,Status,ContactName,Phone,RequestId) VALUES(${c7.id},${s120.id},N'x',0,'${D}T09:00:00','${D}T10:00:00','Maybe',N'x','0900000000',NEWID())`), 547);
  assert.equal(err(`INSERT INTO Appointments(UserId,ServiceId,ServiceName,Price,StartAt,EndAt,Status,ContactName,Phone,RequestId) VALUES(${c7.id},${s120.id},N'x',0,'${D}T10:00:00','${D}T09:00:00','Pending',N'x','0900000000',NEWID())`), 547);
  assert.equal(err(`INSERT INTO ConsultationServices(Name,Price,DurationMinutes) VALUES(N'${tag}-bad',0,5)`), 547);
  assert.equal(err(`UPDATE ConsultationHours SET OpenTime='18:00', CloseTime='09:00' WHERE DayOfWeek=1`), 547);
  pass('Consultation.sql reruns keep data; DB enforces (UserId, RequestId) uniqueness, status/range/duration/hours checks');
} finally {
  for (const c of connections) await c.stop().catch(() => {});
  const ids = users.join(',') || '0';
  const sids = services.join(',') || '0';
  sql(`DELETE FROM Appointments WHERE UserId IN (${ids}) OR ServiceId IN (${sids});
       DELETE FROM ConsultationServices WHERE Id IN (${sids}) AND Name LIKE N'${tag}%';
       DELETE FROM ConsultationClosedDates WHERE Reason=N'${tag}';`);
  if (hoursSnapshot !== null) {
    const rows = hoursSnapshot ? hoursSnapshot.split(';').map(r => r.split(',')) : [];
    const values = rows.map(([d, open, o, c, slot, cap]) => `(${Number(d)},${Number(open)},'${o}','${c}',${Number(slot)},${Number(cap)})`).join(',');
    sql(`SET XACT_ABORT ON; BEGIN TRAN; DELETE FROM ConsultationHours;${values ? ` INSERT INTO ConsultationHours(DayOfWeek,IsOpen,OpenTime,CloseTime,SlotMinutes,CapacityPerSlot) VALUES ${values};` : ''} COMMIT;`);
  }
  if (users.length) sql(`DELETE FROM Users WHERE Id IN (${ids}) AND FullName='${tag}'`);
  console.log('Temporary consultation fixtures cleaned up; weekly hours restored.');
}
