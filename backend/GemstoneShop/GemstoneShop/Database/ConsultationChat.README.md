# Consultation booking & staff chat

## Deploy
1. Apply the existing scripts (Person3, Wishlist, Payment, CategoryHierarchy, ProductSearch, Reviews).
2. Apply `Consultation.sql` and `Chat.sql` with the target database selected (`sqlcmd -d <db> -b -f 65001 -i …`) **before** starting this backend.
3. Optional demo data: `ConsultationSampleData.sql` (3 services + weekly hours, inserts only what is missing).

Both schema scripts are additive, run in one transaction under an application lock and are safe to rerun; no data is changed.
All foreign keys are NO ACTION. No scaffolded file was edited: `Data/ConsultationContext.cs` and `Data/ChatContext.cs`
are called from `OnModelCreatingPartial` in `Data/CommerceContext.cs`.

Tables: `ConsultationServices` (unique name, price ≥ 0 where 0 = free, duration 15–240), `ConsultationHours`
(DayOfWeek 0 = Sunday … 6, slot 15–240 min, capacity 1–20, open < close when open), `ConsultationClosedDates`,
`Appointments` (snapshot name/price, store-local StartAt/EndAt, status check, unique (UserId, RequestId), index (StartAt, Status)),
`ChatConversations` (one per customer, Open/Closed, per-side last-read message id) and `ChatMessages`
(bigint id, unique (ConversationId, ClientMessageId), index (ConversationId, Id), optional ProductId).

## Rules
- Store time is Asia/Ho_Chi_Minh (fallback "SE Asia Standard Time", then fixed +07:00) via `StoreClock` over an injected `TimeProvider`.
- Slots start at OpenTime every SlotMinutes and must end by CloseTime. A service longer than a slot occupies consecutive slots;
  capacity is shop-wide per slot and counts Pending/Confirmed appointments overlapping the slot.
- Bookable: from now + 2 h up to today + 60 days, not on closed dates or closed weekdays.
- Booking takes SQL application locks `consult:user:{id}` → `consult:config` (shared) → `consult:day:{date}` and re-checks
  availability inside the transaction; hours/closed-date changes take `consult:config` exclusively. Idempotent by (UserId, RequestId):
  same body replays, different body → 409. Max 3 upcoming Pending/Confirmed per customer; no overlap with the customer's own bookings.
- Customer cancel: Pending/Confirmed and ≥ 2 h before start. Admin: Pending→Confirmed/Cancelled, Confirmed→Completed/NoShow/Cancelled
  (Completed/NoShow only after start), compare-and-set on the current status.
- Hours changes or closing a day that would leave upcoming Pending/Confirmed bookings outside opening hours return 409 with the
  affected list unless `force=true`; bookings are never cancelled automatically. Deleting a service that has bookings hides it.
- Chat: login required; admins use the inbox endpoints. One conversation per customer, created by the first message; a customer
  message reopens a Closed conversation. Messages are plain text (1–2000 chars after trim), idempotent by ClientMessageId, limited
  to 8 per 30 s per sender (429) and published only after commit.
- SignalR `/hubs/chat`: server-managed groups only (`chat:customer:{userId}`, `chat:staff:{adminId}`); recipients are re-checked against
  the database on every event so locked accounts stop receiving. `AppointmentChanged {appointmentId}` is sent on `/hubs/orders` and
  `/hubs/chat` after commit; delivery failures are logged and never fail the request.

Routes:
`/api/consultation/{services,availability,hours}`, `/api/appointments[/{id}[/cancel]]`, `/api/admin/appointments[/{id}[/status]]`,
`/api/admin/consultation/{services,hours,closed-dates}`, `/api/chat/{me,me/messages,me/read,unread}`,
`/api/admin/chat/conversations[/{id}[/messages|/read|/status]]`.

Tests: `tests/consultation.integration.mjs`, `tests/chat.integration.mjs` (local database only).
