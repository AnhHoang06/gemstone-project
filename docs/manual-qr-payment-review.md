# Manual QR payment verification

Branch: `feature/manual-qr-payment-flow`
Baseline: `origin/develop` at `f30ba63d43bf15193deaa163e72bd70c5a8f4089`
Reviewed: 2026-11-02

## Automated verification

- Backend build: PASS, 0 warnings/errors (`dotnet build ... --nologo -p:NuGetAudit=false`).
- Full frontend lint: PASS.
- Full frontend tests: PASS, 181 tests / 25 files (`npm test -- --maxWorkers=2`). An initial run caught the obsolete Admin confirmation button label in an existing test; its assertion was updated to the new required label, and the full suite rerun.
- Frontend production build: PASS. Existing bundle-size warning (>500 kB main chunk) remains.
- Integration suites: PASS for payment, person3, wishlist, catalog (including restart/backfill), product-removal, reviews/Q&A/engagement, analytics, consultation and chat.
- Payment integration rerun with configured fixture bank: PASS. Independent OpenCV decoding of the generated PNG verified exact amount, account/BIN, VND, DH reference and CRC.
- Payment integration rerun without bank configuration: PASS; no fabricated account or QR returned.
- PaymentReported.sql executed twice against local development DB: PASS; existing nullable datetime2 accepted, no historical backfill.

Temporary test accounts/products/orders were removed in suite cleanup. Consultation tests restored original weekly hours. The fixture bank values existed only in test-process environment variables and must never be used to transfer money.

Payment coverage includes JWT ownership/roles, unreported/COD/invalid/completed/cancelled rejection, concurrent first reports, stable report timestamp and UpdatedAt, two-admin confirm (one 200 and one 409), stable PaidAt, cart/line items/inventory unchanged by confirmation, cancellation races, COD collection only on completion, QR suppression for ineligible states/unsupported fractional amounts, and Completed + Paid analytics based on historical prices. Existing secure SignalR events were observed after report/confirmation; replay did not emit duplicate events.

## UI behavior checked by code and React tests

- Local QR with reserved square dimensions and max-width:100%; explicit transfer amount/reference; bank text wraps.
- Pending bank order shows report action; report succeeds only after API response, then refetches and removes the action.
- API errors are visible and refetch stale state; repeated clicks are blocked.
- Paid/cancelled orders do not show transfer instructions.
- Admin confirmation is available only after customer report; COD uses its separate order-confirmation action.
- Customer lists/detail retain cancellation rules and expose payment links for Pending/Unpaid bank orders.
- Existing session-keyed CommerceProvider isolates account state; stale report completion cannot refresh a new session.

## Outstanding manual checks (NOT PASS)

Visual browser checks at **1366px and 390px remain unverified**. The available browser previously rejected localhost access under its saved site permission/managed policy. No alternate browser automation was used to bypass that denial. DOM assertions and CSS inspection are not visual proof.

Before marking the PR ready:
1. Open an owned Pending/Unpaid BankTransfer order with real approved store configuration at both widths.
2. Check QR quiet zone/overflow, bank alignment, amount/reference selection, report/refresh button layout, and persisted reported state.
3. Scan with a banking app and verify beneficiary, exact amount and DH reference **without submitting a transfer**.
4. Confirm Admin receives the report, verifies actual bank receipt separately, and the single confirmation action updates both payment/order status.

No real banking-app scan or actual transfer was performed. QR syntax/decoding cannot prove beneficiary ownership or universal bank-app compatibility. Keep the PR draft until visual checks are completed.

## Deployment and scope

Run `backend/GemstoneShop/GemstoneShop/Database/PaymentReported.sql` after existing Person3.sql/Payment.sql, before deploying. Required keys and state rules are documented in Payment.README.md beside the script. No sample script is required.

No gateway, webhook, automatic bank verification, override, refund, scaffold edits, analytics formula change, or unrelated feature integration. `.payment-order-worktree/` and `docs/product-image-list.md` remain unrelated/untracked and are not included.
