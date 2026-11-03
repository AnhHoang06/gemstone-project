# Intended-state reconciliation audit — 2026-11-03

Fetched origin before review. Local develop and origin/develop are both `f30ba63d43bf15193deaa163e72bd70c5a8f4089`; current branch `fix/dashboard-realtime-analytics` is `23272941f20d7d1b181f10a7731fe3082ac8ccfb` plus pending realtime edits.

## Source of truth (before reconciliation)

| Work | Correct commit/source | origin/develop | Current branch | Finding / action |
|---|---|---|---|---|
| Review/Q&A/engagement | 308ccc9, 4339527, f32b224 | Yes | Yes | Preserve |
| Analytics dashboard | 8cad78c, 905178a, 778d7fb, 3b8d92f | Yes | Yes | Preserve |
| Dashboard realtime | six pending files on current branch | No | Working tree only | Commit separately, retain session-scoped events |
| UI polish | eb41026 | Yes | Yes | Preserve |
| Demo taxonomy / old image removal | e48ce1f | Yes | Yes | No evidence of a new regression |
| 14-image catalog and data | 2327294 | No | Yes | Include isolated commit; DB already correct |
| Support Center | bf42f76 / feature/support-center | No | No | /ho-tro still placeholder; integrate page without old /kien-thuc route |
| Contact form/admin inbox | 3af7d84 / feature/contact-module | No | No | Reconcile form with newer Contact Chat page, do not overwrite Chat |
| Remove knowledge page | f30ba63 | Yes | Yes | Only negative test references remain |
| Consultation/Chat | 831716e (#14) | Yes | Yes | Keep hours, booking and ChatPanel |
| Manual QR payment | cb76765 / feature/manual-qr-payment-flow | No | No | Integrate newer flow, not older payment-order branch |
| QR copy UX/exact amount | seven pending QR-worktree files | No | No | Separate commit before integration |
| Shipping edit | 1e605be / feature/order-shipping-edit | No | No | Integrate, reconcile OrderDetail/OrdersController overlaps |

## Cause

No fetched develop commit has reverted the completed cleanup. The latest develop merge `2cae92f` contains reviews, analytics and UI polish; `f30ba63` removes knowledge navigation. Missing functionality resides on unmerged branches or in uncommitted working trees. Running a different worktree exposes a different feature set. In particular old develop seed scripts lack the Catalog14 guard introduced by 2327294; rerunning those can attempt to restore the old fixture sets. No evidence establishes that such a rerun actually happened.

Support branch's historical App contains /kien-thuc; Contact branch's historical App contains placeholder booking/support routes. Never copy either App wholesale. Reconcile only intended route additions.

## DB audit (read-only)

Five active categories: Ruby 3, Sapphire 3, Emerald 3, Diamond 2, Amethyst 3. Exactly 14 active products and 14 ProductImages for them. Historical Products 136/223/224/225 exist and are inactive. Orders 2548/2658/2709/2710/2712 exist with totals 5,200,000 / 4,850,000 / 5,200,000 / 4,850,000 / 11,080,000; BankTransfer + Unpaid. DBCC CHECKCONSTRAINTS reports no violations. No catalog reset or reseed needed.

## Preservation / integration plan

Preserve all original worktrees and untracked files. Separate commits for reviewed pending realtime and QR polish work; reconcile in a new isolated branch/worktree based on current branch, adding the complete QR, shipping, Support and Contact commits. Resolve shared files deliberately. Do not merge or push develop until the audit and complete verification pass. Old `.payment-order-worktree` is superseded and must not be integrated. Catalog image runtime copy in QR worktree is a duplicate deployment asset, not a second source commit.

## Verification status

Audit phase complete; integration verification pending. Do not infer PASS from earlier standalone branch results. No develop merge/push has occurred.

## Reconciliation performed

New isolated branch `codex/restore-intended-state`, preserving all existing worktrees:
- `f1df3da`: commit the reviewed realtime fix (original branch).
- `57fc9b0`: commit QR copy/exact-amount polish (original QR branch).
- `9f48d89`: integrate cb76765 manual QR flow.
- `abd5a5e`: integrate 57fc9b0 follow-up.
- `6ccdf1c`: integrate shipping edit 1e605be.
- `82352f0`: integrate Support bf42f76, preserve deleted knowledge route.
- `a37ecb0`: integrate Contact 3af7d84 with existing Chat page. Form extracted to ContactMessageForm, session-keyed; retained chat, API working hours, booking, admin consultation and chat navigation.

No newer develop feature was overwritten. App shared conflicts were resolved line-by-line; no ours/theirs replacement. PlaceholderPage file retained but no registered route uses it now. `/test-categories` was pre-existing and left unchanged rather than silently broadening route cleanup.

## Findings and verification after reconciliation

- Database unchanged by reconciliation aside from temporary, cleaned integration fixtures: 5 public categories, 14 public products, 14 local public images, 69 inactive products, 575 orders, 173 reviews; 0 invalid verified-purchase references; no FK violations.
- Five protected orders and four protected inactive product IDs remain unchanged.
- New public dataset contains no Test/Demo/Sample/Mẫu names. Removed old demo-image directories/attribution files have not reappeared. Current two WebP images are from the approved new ZIP, not the deleted web-image task.
- Two inactive original product image references (2,27) point to files absent from the workspace; pre-existing, preserved, outside public catalog.
- Routes: /admin/dashboard, /ho-tro (real SupportPage), /lien-he (Chat + contact form), /hen-lich (Booking), /admin/contacts all registered; /kien-thuc absent. Knowledge strings only remain in tests asserting absence.
- ProductDetail still includes Reviews, Questions, Related/RecentlyViewed, ChatProductContext.
- ContactMessages table and PaymentReportedAt already existed; no deployment schema or catalog rebuild was run during reconciliation. Teammates need existing ContactMessages.sql, PaymentReported.sql, Consultation.sql, Chat.sql plus baseline Person3/Wishlist/Payment/CategoryHierarchy/ProductSearch/Reviews scripts. Catalog14Rebuild is optional, guarded local demo migration, not a production migration.
- Backend build PASS (0 warnings/errors).
- Integration PASS: person3, wishlist, payment (actual QR + reported transfer + admin receipt + COD), catalog, product-removal, reviews/Q&A, analytics, dashboard-realtime, consultation, chat, contact, order-shipping; catalog14 API/SQL/image verification PASS.
- Two initial reconciliation failures were resolved: retained Chat's no-empty-contact-card behavior; realtime test now uses real report/confirm APIs instead of the obsolete SQL Paid fixture and expects COD collection on completion. No test was skipped or weakened.
- No browser visual PASS claimed. Existing bundle-size warning remains.

All remote pushes remain withheld. Final frontend result and local develop HEAD are recorded below after verification.

Final frontend verification: lint PASS, 236/236 tests across 30 files PASS, build PASS (existing >500 kB bundle warning only). All tests were run against the reconciled source. Local develop may be fast-forwarded to this verified branch; origin/develop remains untouched until a separate push.
