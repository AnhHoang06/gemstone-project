# Contact module delivery review — 2026-10-31

## Baseline / isolation

- Branch: feature/contact-module, separate worktree from origin/develop at bea761bec8b9e767a6539e66afbce305393de036.
- Existing feature/product-review-engagement worktree and its nine pending UI-polish edits plus report are preserved.
- Dashboard analytics on the separate feature branch is deliberately not pulled into this develop-based Contact branch.
- No scaffolded model/context, auth/session/API client, cart/order/payment/wishlist, or product/category business logic changes.

## Delivered

- Public /lien-he: configured contact information only, accessible Vietnamese inline validation, sending/error/success states, no browser alerts.
- Guest/customer contact submission with JWT-derived optional ownership and bounded validation.
- Admin /admin/contacts and /admin/contacts/:id: status filters, pagination, newest first, clickable keyboard-accessible rows, private detail and note/status editing.
- Admin navigation link; existing Header/Footer links already target /lien-he.
- Additive idempotent ContactMessages SQL + handwritten partial model/context mapping; required deployment script documented.
- Shared existing Axios and session utilities. Session changes reset the public draft and remount admin data to prevent previous-session responses appearing.

## Verified by executed checks

- Backend build: PASS, zero warnings/errors.
- Full frontend lint: PASS.
- Full frontend React tests: PASS, 118 tests in 17 files (11 new Contact tests).
- Frontend build: PASS; existing main-bundle >500 kB advisory remains.
- Contact integration: PASS (guest/customer/spoofing/validation/admin-only list-detail-update/private note/inactive JWT/schema rerun).
- Existing integrations: person3, wishlist, payment, catalog (including second-instance backfill), product-removal, reviews/Q&A: all PASS.
- Test data cleaned. ContactMessages table intentionally remains as the additive deployment.
- npm ci reported 11 dependency advisories (6 moderate, 5 high) from the existing locked dependency set; no dependency/lockfile changes made.

## Manual visual check: NOT COMPLETE

Browser access to http://localhost:2222 was denied by the browser permission gate earlier in this chat, even after the user showed Always allow. No alternate-browser workaround was used. Contact layout is implemented responsively, but **1366px and 390px visual results are not claimed as PASS**. Browser guest/customer/admin workflows remain a manual QA item; API and React coverage above is not a substitute.

Before merge, inspect /lien-he at 1366px and 390px: empty configured information, inline errors, valid guest/customer submission, success reset, no horizontal overflow. Inspect /admin/contacts, keyboard row navigation, private message detail, InProgress + internal note + Resolved. Confirm focus outlines and table-local horizontal scrolling on mobile.

## Limitations

No mail sending, CAPTCHA, backend rate limiter, customer request history, sample-data seed, or cross-request submission idempotency. Admin updates are last-write-wins. These are intentionally outside the minimal module; see ContactMessages.README.md.
