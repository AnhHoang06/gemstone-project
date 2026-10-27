# Minimal payment tracking

Run `Payment.sql` against the existing application database **before** deploying this code. It is additive and repeatable; it never recreates the database or changes historical orders. Existing orders retain NULL payment fields. Keep the partial Order payment model/mapping when re-scaffolding (avoid duplicate properties after scaffolding the new columns).

New checkout requests accept `paymentMethod: "COD" | "BankTransfer"`. Omitted values remain compatible with old clients and default to COD for new orders. Every new order starts Unpaid with PaidAt NULL. The payment method is included in the request fingerprint when supplied. Existing requests/receipt hashes without this field remain replayable; replay returns the method stored on the order, including NULL for historical orders.

The owner-only `GET /api/orders/{id}/payment` exposes amount, method/status and configured transfer instructions. Configure real values through User Secrets or environment variables:

- `Payment__BankTransfer__BankName`
- `Payment__BankTransfer__AccountNumber`
- `Payment__BankTransfer__AccountHolder`

No bank data is checked into the repository. If any value is missing, the page explains that bank details are unavailable and does not show transfer instructions. No QR, gateway, transfer-submission endpoint, or automatic paid transition exists. “Tôi đã chuyển khoản” is an informational acknowledgment only; it neither sends a payment claim nor changes database state. Admin reconciliation is a separate future feature. Order completion and cancellation do not change payment status.

Verification: `tests/payment.integration.mjs` uses a local API/SQL Server, creates isolated temporary fixtures, and removes them in finally. Apply Payment.sql first. Existing Person 3 and Wishlist scripts remain compatible.
