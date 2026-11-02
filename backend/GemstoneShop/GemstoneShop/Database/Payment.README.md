# Manual QR payment flow

## Deployment (Database First)

On the existing database, apply `Person3.sql`, `Payment.sql`, then **`PaymentReported.sql` before deploying this version**. Existing installations need only the new script. It adds nullable `Orders.PaymentReportedAt datetime2`, is safe to repeat, and never backfills historical payment recognition. It also accepts the equivalent column from the earlier experimental PaymentOrderFlow script. No new transaction table, schema reset, or scaffold edits.

Keep `Order.Payment.cs` and `CommerceContext.cs` partial mappings when re-scaffolding; reconcile duplicate generated properties explicitly. PaidAt and PaymentReportedAt are returned as UTC. This change requires no demo/sample scripts.

## Configuration and QR

Set real store details through User Secrets or environment variables, never committed values:

- `Payment__BankTransfer__BankName`
- `Payment__BankTransfer__BankBin` — official 6-digit bank BIN (not a SWIFT code)
- `Payment__BankTransfer__AccountNumber` — 1–19 ASCII letters/digits
- `Payment__BankTransfer__AccountHolder`

All four are required. Missing/invalid configuration suppresses bank details and QR and produces a clear unavailable state. Verify the configured beneficiary with the bank before accepting real transfers. Syntax validation cannot verify account ownership.

The owner-only `GET /api/orders/{id}/payment` produces a local PNG data URI using **QRCoder 1.8.1 (MIT)**. No external QR service receives bank or order information. The NAPAS account-transfer payload uses GUID A000000727, QRIBFTTA, VND 704, bank BIN/account, the exact order total and DH{OrderId}, with CRC16-CCITT. Positive whole-dong amounts up to the format's 13-character limit are supported; unsupported amounts produce an explicit QR error and are never rounded. No QR is returned for COD, cancelled, paid or non-Pending orders.

Implementation references:
- https://github.com/Shane32/QRCoder
- https://github.com/iamv4g/vietqr.dart/blob/main/packages/vietqr_core/vietqr_field_definitions_en.md

The QR encodes transfer instructions, **not bank verification**. Automated PNG decoding is tested; a real banking-app scan/beneficiary confirmation is still required before production use. No real bank details are supplied by this repository.

## State transitions and APIs

Checkout remains `POST /api/orders` with server-side cart pricing, inventory transaction and CheckoutReceipts idempotency. Omitted paymentMethod still defaults to COD, and old no-payment receipt hashes remain compatible. Existing NULL payment fields are not changed.

BankTransfer:
1. Checkout commits Pending + Unpaid and redirects to `/payment/{id}`.
2. Owner `POST /api/orders/{id}/payment-reported` sets **only PaymentReportedAt**. Replays while Pending/Unpaid return the same timestamp, without duplicate events. It never means money was received.
3. Admin `POST /api/orders/admin/{id}/confirm-payment` requires reported + Pending + Unpaid + BankTransfer and atomically sets Paid, UTC PaidAt, Confirmed, UpdatedAt. Repeated/already-paid, unreported, COD and invalid-state requests return 409; missing/not-owned orders return 404; normal JWT/Admin authorization applies. No manual override.
4. Admin then moves Confirmed → Shipping → Completed. PaidAt remains unchanged.

COD: Pending → Confirmed → Shipping stays Unpaid. Shipping → Completed atomically records Paid/PaidAt. Admin must only complete after successful delivery and collection. Replays do not rewrite PaidAt.

Reported but unpaid orders retain existing cancellation rules. Paid orders cannot be cancelled through these APIs because refunds are not implemented. Legacy orders with unknown payment state remain clearly labelled; no historical paid status is inferred.

All report/confirm/status/cancel operations share the transaction-owned SQL `order:{id}` application lock and conditional writes. They serialize across backend instances using the same database. Confirmation never changes stock, cart or line items. The existing secure OrderStatusChanged publication runs after commit, rechecks active recipients, and logs delivery errors without failing the committed action. Clients refetch on events/reconnect; session-keyed providers isolate users.

## Dashboard

Revenue remains **Completed AND Paid**, grouped by the existing UTC order-created date and calculated from historical OrderDetails.UnitPrice × Quantity. Reported-only transfers, confirmed-but-unfulfilled paid orders and unpaid COD are excluded. No analytics calculation changes were needed.

## Verification

Run backend build and frontend lint/test/build. `tests/payment.integration.mjs` uses local-only generated fixtures and finally cleanup; set PERSON3_API_URL to the intended test API. SQL connection uses PERSON3_SQL_SERVER/PERSON3_SQL_DATABASE. Tests cover atomic checkout, report replay, authorization, concurrent admin confirmation, cancel/confirm, stable timestamps, COD collection, secure SignalR notification and analytics recognition.

For configured-bank QR tests, the test process must receive the same Payment__BankTransfer__* environment values as its API. PNG decoding uses test-only Python `opencv-python` and `numpy`; these are not runtime application dependencies. Run once with isolated fixture bank values and once with empty bank settings. Never use the test fixture account for actual transfers.

Browser visual verification at 1366px/390px and a real bank-app scan are tracked separately in `docs/manual-qr-payment-review.md`; automated DOM tests do not substitute for those checks.

## Future extension — documentation only

A future VNPay/MoMo/provider webhook, bank webhook or virtual-account callback must verify signature/authenticity, beneficiary, amount, reference and replay identity on the backend before applying Paid + Confirmed through the same concurrency controls. No gateway, callback endpoint, fake webhook, automatic verification or refund implementation is included here.
