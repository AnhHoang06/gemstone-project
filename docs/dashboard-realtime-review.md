# Dashboard realtime diagnosis and fix

Baseline: origin/develop `f30ba63d43bf15193deaa163e72bd70c5a8f4089` (fetched 2026-11-03, Asia/Saigon).
Branch: `fix/dashboard-realtime-analytics`. No merge, commit or push performed.

## Reproduction before production-code changes

The new React regression test mounted the real CommerceProvider and Dashboard, injected OrderStatusChanged through the provider's registered SignalR handler, and changed the mock authoritative analytics response. It failed: analytics request count stayed **1**, expected greater than 1. Dashboard retained old KPI/chart data. Manual refresh changes the request URL's refresh counter and therefore fetches the new values; a separate test proves that path works.

A real local SQL/API/SignalR integration fixture created a two-unit order at 1,000,000 VND/unit. A disposable BankTransfer fixture was marked Paid directly in SQL because current develop has no manual bank-confirmation endpoint. The existing admin API moved it through Confirmed/Shipping to Completed. A separate authenticated admin SignalR client read order and analytics immediately upon OrderStatusChanged:

- Persisted status: Completed; payment: Paid.
- Revenue: +2,000,000 VND; completed orders: +1; units: +2.
- Trend sum and breakdown sum: +2,000,000 VND.
- All categories, category and product filters with 30d range all matched.
- Inventory remained unchanged by completion.

Thus the event is published after commit and the API is current. The missing frontend invalidation is the confirmed realtime root cause, not a premature event or backend analytics cache.

## Existing business rule and separate COD limitation

Analytics requires **Completed AND Paid**, uses historical OrderDetails.UnitPrice × Quantity, and buckets by order CreatedAt UTC. It does not use completion/payment date. Only matching line items count under category/product filters. This rule is unchanged.

On this develop baseline, COD completion changes only OrderStatus: Shipping/Unpaid → Completed/Unpaid, PaidAt stays null. Real integration reproduced this and revenue correctly stayed unchanged. Automatic COD recognition and bank confirmation belong to unmerged PR #17 (`feature/manual-qr-payment-flow`). They were deliberately not copied into this UI fix. Consequently the requested COD Completed+Paid scenario cannot pass on latest develop yet; integrate/review that payment feature separately. The baseline regression test explicitly documents the current Unpaid result and must be updated when that business rule lands.

There is no recent-orders/status block in the current analytics Dashboard to refresh. Order list/detail already consume the provider revision.

## Fix

- New dashboard-specific `useDashboardAnalytics` hook reads the existing session-scoped CommerceProvider revision. OrderStatusChanged, NewOrder and reconnect/start already increment it.
- No extra hub, event type or listener; no frontend revenue arithmetic.
- Coalesce realtime bursts over 200ms. Filters/manual refresh still load immediately.
- Keep existing same-filter KPI/trend/breakdown data while revalidating. On error retain it and show an error/retry action.
- Query string is built from unchanged range/category/product/date state. Metric and mixMetric remain component state.
- Effect cleanup cancels queued work and ignores old in-flight results after superseding events, filter changes or unmount. Session-keyed CommerceProvider remounts user-scoped state.
- Shared useApiData remains unchanged; options are not needlessly reloaded for every order event.

## Verification

- Backend build: PASS, 0 warnings/errors.
- Full frontend lint/build: PASS; existing large-bundle warning remains.
- Full frontend tests: PASS, 177 tests / 25 files (`npm test -- --maxWorkers=2`).
- Integration: dashboard-realtime, person3 (including SignalR authorization/revocation), payment and analytics PASS; generated fixtures cleaned in finally.
- Frontend tests cover actual provider event forwarding, refreshed KPI/trend/breakdown, actual Chart.js line/donut configuration updates, unchanged filters/metric selection, burst coalescing, background error/retry, reconnect, stale response rejection and cleanup without new subscriptions.

## Browser verification limitation — NOT PASS

Attempted to open http://localhost:2222/admin/dashboard through the available browser. It explicitly rejected access: saved permission/managed policy denied the origin. No alternate browser or automation workaround was used. Two live browser-window observation remains unverified; React DOM/Chart.js tests plus real API/SQL/SignalR checks are separate evidence, not a claim of manual browser verification.

Once access is allowed, open Dashboard at 30d with a matching category/product, complete an eligible already-Paid order in another admin session, and verify KPI/line/donut change without manual refresh. Also test an order created outside the selected date range (correctly no increase), reconnect, and background failure recovery. Test COD Paid recognition only after the separate payment implementation is available.

No backend/schema changes or SQL deployment scripts are required for this fix. Existing unrelated `.payment-order-worktree/` and `docs/product-image-list.md` remain untouched.

## Files changed

- frontend/src/pages/admin/AdminDashboard.jsx
- frontend/src/hooks/useDashboardAnalytics.js
- frontend/src/pages/admin/AdminDashboard.test.jsx
- frontend/src/pages/admin/AdminDashboard.realtime.test.jsx
- tests/dashboard-realtime.integration.mjs
- docs/dashboard-realtime-review.md

## Reconciled payment baseline (2026-11-03)

Manual QR confirmation is now integrated on the restoration branch. The realtime suite uses customer payment-reported and Admin confirm-payment APIs, not a direct SQL Paid fixture. COD completion atomically changes payment to Paid and adds revenue. Earlier baseline notes describing PR #17 as missing are historical, not the current reconciled behavior. Browser visual limitations still apply.
