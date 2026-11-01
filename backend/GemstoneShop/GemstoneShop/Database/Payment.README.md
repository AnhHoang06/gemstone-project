# COD and manual bank transfer

## Deployment (Database First)

Run the existing `Payment.sql`, then **`PaymentOrderFlow.sql`**, against the existing application database before deploying this code. Both are additive/idempotent. The new script adds only nullable `Orders.PaymentReportedAt datetime2`; it does not recreate the database or backfill history. It was run twice successfully locally.

```powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -i backend/GemstoneShop/GemstoneShop/Database/Payment.sql
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -i backend/GemstoneShop/GemstoneShop/Database/PaymentOrderFlow.sql
```

Existing Person3/Wishlist/CategoryHierarchy/ProductSearch/Reviews schemas remain required by their modules. Latest develop also requires its existing `Consultation.sql` then `Chat.sql`; these scripts are unchanged by this feature. No demo seed is required.

Only `Order.Payment.cs` and the existing partial `CommerceContext.cs` extension are edited. Scaffolded `Order.cs`/`GemstoneShopContext.cs` are untouched. Retain partial mappings when re-scaffolding and avoid duplicate generated properties. `PaidAt` and `PaymentReportedAt` are UTC, including JSON responses read back from SQL (explicit UTC kind conversion).

## Exact flows

| Action | Order status | Payment status |
| --- | --- | --- |
| New COD checkout | Pending | Unpaid |
| Admin confirms COD order | Confirmed | Unpaid |
| Admin ships COD | Shipping | Unpaid |
| Admin completes delivery **and collection** | Completed | Paid; server UTC PaidAt |
| New bank-transfer checkout | Pending | Unpaid |
| Owner reports a transfer | Pending | Unpaid; server UTC PaymentReportedAt |
| Admin verifies receipt of bank funds | Confirmed | Paid; server UTC PaidAt |
| Admin ships/completes a verified transfer | Shipping / Completed | Paid; original PaidAt retained |

Admin completion of COD explicitly represents successful delivery and money collection; the detail page explains this before the action. Do not complete an uncollected COD order. This is a manual process, not bank/gateway verification.

A bank order with no report stays Pending + Unpaid. An admin can still verify actual received funds without requiring a customer report. The ordinary status endpoint cannot bypass bank verification. A report never sets Paid, and reporting/confirming never decrements inventory.

Checkout still uses server cart totals, snapshots, inventory transaction and CheckoutReceipts. Omitted paymentMethod remains COD for new requests; old receipt hashes remain replayable. Legacy NULL payment fields remain unknown and are not silently marked Paid when old orders complete. Existing inconsistent historical bank orders (e.g. Confirmed + Unpaid) require explicit reconciliation; this patch does not rewrite them.

## APIs

- `POST /api/orders/{id}/payment-reported`: authenticated owner only; no client user ID or amount accepted. Requires Pending + Unpaid + BankTransfer. Persists the first report timestamp only.
- `POST /api/orders/admin/{id}/confirm-payment`: Admin only. Requires BankTransfer, Pending, Unpaid. Atomically sets Paid/PaidAt and Confirmed in one SQL UPDATE.
- `PUT /api/orders/admin/{id}/status`: existing route; COD Shipping → Completed collects payment atomically. Bank forward transitions require verified payment.
- Existing list/detail/payment GET responses now include `paymentReportedAt`.

Missing/other-owner orders return 404; anonymous calls 401; non-admin confirmation 403; invalid method/state or cancelled order 409. Already-applied reports and already-paid Confirmed/Shipping/Completed bank confirmations return 200 with `replayed: true`, without changing timestamps or publishing another event. Cancelling a previously cancelled order remains an idempotent no-op.

All order/payment transitions use the same transaction-owned SQL application lock `order:{id}`, plus conditional UPDATE. This serializes API requests across backend instances sharing the database, including cancellation versus confirmation. Two administrators cannot each apply the transition. Only cancellation owns stock restoration, once. Direct SQL edits do not participate in the application protocol and should not be used as normal order actions.

## Cancellation and realtime

Existing unpaid cancellation rules remain: customer Pending only; admin Pending/Confirmed. Reported-but-unverified bank transfers are still Unpaid. Cancelling any Paid order is blocked with a manual-handling explanation; no refund is invented and payment is never silently reset.

Successful report/confirmation publishes the existing `OrderStatusChanged` event only after commit. Existing secure owner/admin recipients, active-account checks, reconnect/refetch and session isolation are reused. Notification failure cannot fail the committed operation. No client-selected groups or new realtime infrastructure are added.

## Customer and admin UI

Customer Payment persists “Tôi đã chuyển khoản”, then displays “Đã báo chuyển khoản - Đang chờ cửa hàng xác nhận”. Reloading retains the report; failure leaves a retry action and inline error. Verified orders no longer request a transfer. Lists/details show separate order/payment badges and payment method; details show timestamps.

Admin Pending COD shows “Xác nhận đơn hàng”; Pending Unpaid BankTransfer shows only “Xác nhận đã nhận thanh toán” instead of a second order-confirm step. Success refetches server state; duplicate clicks are disabled. Paid cancellation actions are hidden with an explanation.

Bank details come exclusively from User Secrets/environment:

- `Payment__BankTransfer__BankName`
- `Payment__BankTransfer__AccountNumber`
- `Payment__BankTransfer__AccountHolder`

Missing configuration shows an unavailable message. No real bank details are committed. The baseline has no valid QR generator/configuration, so no QR is fabricated; configured manual instructions and `DH{OrderId}` remain in use.

## Revenue rule

`GET /api/dashboard/summary.totalRevenue` sums server-saved `Order.TotalAmount` only for **Completed AND Paid** orders. Paid but not yet completed transfers are not recognized sales yet. Customer reports, unpaid COD, cancelled orders and legacy unknown payment states are excluded. Product current prices are not used. Latest develop contains the summary dashboard, not the separate unmerged analytics branch; no analytics branch was pulled into this feature.

## Verification — 2026-11-01

- Backend build: PASS, 0 warnings/errors.
- Full frontend lint/build: PASS; existing >500 kB bundle warning remains.
- React: PASS, 23 files / 166 tests.
- Integration: PASS payment, person3, wishlist, catalog (including second-instance restart/backfill), product-removal, reviews/Q&A, consultation, chat.
- Payment tests exercise flows A–D through the real local API/SQL: initial Unpaid, persistent report, two-admin concurrent confirmation, stable PaidAt/retry, authorization/ownership, COD collection, cancelled rejection, cancel/confirm race, stock invariants, secure realtime notification and revenue deltas. Fixtures are cleaned in finally.
- Browser/manual visual acceptance was not performed; API flows and React interactions are verified, not a claim of browser visual PASS.

Local execution: set `PERSON3_API_URL` to the local backend (verification used `http://localhost:5131`) then `node tests/payment.integration.mjs`. Other suites retain their documented environment variables. Run only against a local development/test database.

## Future gateway integration — documentation only

A real VNPay/MoMo/bank-webhook or virtual-account integration would receive an authenticated callback, verify provider signature and transaction identity/amount/currency, apply idempotency, then atomically mark Paid and Confirmed using the same order transition protection. No callback endpoint, fake payment success, refund service or external gateway is implemented here.
