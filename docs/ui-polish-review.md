# UI stabilization review — 2026-10-31

## Baseline and Git

- Branch: `feature/product-review-engagement`.
- Dashboard work was reviewed and committed separately as `778d7fb` on `feature/admin-analytics-dashboard`.
- Merge baseline: `3b8d92f`. One conflict in `Services/CatalogQueries.cs` was resolved by preserving the current Vietnamese search implementation and adding Dashboard's category-membership helper.
- Baseline working tree was clean before UI edits. No push or merge into develop was performed in this task. At the original audit, UI changes remained uncommitted pending completion of visual QA. See the separate commit review below for the later authorization; visual limitations remain explicit.

## Findings and fixes

| Severity | Finding | Change |
| --- | --- | --- |
| High | Mobile Cart cards inherited the shared table's 720px minimum; prices and quantity controls required horizontal scrolling. | Reset only the mobile cart table minimum. Verified table width 342px inside its 342px container at a 390px viewport. |
| High | Admin Products converted a failed list request into a misleading empty state. | Show a Vietnamese inline error; added a React regression test. API and deletion behavior unchanged. |
| Medium | Related products loaded above reviews, shifting the destination of `#reviews` and putting several mobile screens before the review form. | Place reviews and Q&A directly after product information, before recommendation shelves. Final hash-navigation visual recheck remains pending. |
| Medium | Admin product prices wrapped between digits. | Give the product table adequate local scrolling width and prevent price wrapping. |
| Medium | Review moderation tabs lacked an obvious selected state; hidden status was plain text. | Emerald active tab, existing active/inactive badges. |
| Medium | Price inputs retained browser spinner arrows. | Hide spinners only on catalog price controls. Numeric values/API filtering unchanged; no new price-format parsing. |
| Cosmetic | Review shelves were unnecessarily tall on mobile; rating/filter/form controls were uneven. | Two-column mobile product shelves, flexible summary distribution, consistent controls/focus/error borders and helpful-button minimum width. |
| Cosmetic | Three review-analytics groups occupied a four-column layout. | Dedicated three-column layout, stacking on mobile. |
| Cosmetic | Global button CSS overrode refresh icon/text alignment. | Scope the refresh flex rule to the analytics page. |

Reused existing buttons, status badges, table wrappers, form controls and design colors. No new dependency, backend business rule, API, schema, route, authentication, payment or SignalR change in the UI polish patch.

## Files in the UI patch

- `frontend/src/pages/ProductDetail.jsx`
- `frontend/src/pages/admin/AdminProducts.jsx`
- `frontend/src/pages/admin/AdminProducts.test.jsx`
- `frontend/src/pages/admin/AdminReviews.jsx`
- `frontend/src/styles/cart-checkout.css`
- `frontend/src/styles/dashboard.css`
- `frontend/src/styles/engagement.css`
- `frontend/src/styles/refinements.css`
- `frontend/src/styles/theme.css`
- This report.

## Verification

- Backend build: PASS, 0 warnings/errors. A preliminary rerun encountered MSB3027/MSB3021 because the local preview held the DLL; stopping that preview and rerunning resolved it.
- Full frontend lint: PASS.
- React tests: PASS, 116 tests across 16 files, including the new product-list load-error test.
- Frontend build: PASS. Existing main-chunk size warning remains (~597kB minified).
- Integrated baseline API suites: analytics, catalog (including second-process backfill), Person3, wishlist, payment, product-removal, reviews/Q&A: all PASS.
- Dashboard seed verifier: PASS, independent SQL/API totals for All, two categories and three products.
- Integration suites ran after the Dashboard merge and before presentation-only edits. The later functional change is frontend error presentation, covered by the new React test.
- Temporary UI customer/admin, their two simulated orders and cart were removed by exact fixture marker in a transaction. Persistent demo/business data was preserved. Temporary credentials were deleted.

## Responsive and screenshot coverage

Admin route width checks completed at 1366, 1024, 768 and 390px: dashboard, products, create/edit product, categories, customers, orders, order detail and review moderation. No page-width overflow was detected in the final route checks; wide tables/navigation retain local horizontal scrolling.

Saved screenshots reviewed include Home and Shop at desktop/mobile; Product Detail, Cart and Order History at desktop; Cart/Account at mobile; Dashboard and Admin Reviews at desktop/mobile; baseline category/product forms and order screens. The Cart mobile fix was visibly verified. Delivery modal was checked at 390px: prefill, cancel, focus return and viewport fit worked without creating an order.

Screenshots are local artifacts in the chat's `ui-audit` visualization folder, not committed product assets. Captured screenshots are viewport images, not proof that every below-fold section or state was reviewed.

## Remaining work / limitations

**Do not call the entire visual audit complete yet.** Browser approval access was interrupted by a usage gate and subsequently denied when reconnecting. No alternate browser/automation bypass was used.

Pending: complete the customer 1024/768px pass, remaining mobile Product Detail/Orders/Payment/Wishlist screens, post-change `#reviews` positioning, lower chart/legend screenshots, keyboard menu/accordion and all error/empty/modal states. Missing screenshots must not be treated as PASS.

Other observations intentionally not changed:

- Dashboard legend can be long for categories with many products; large revenue may wrap the currency symbol on a KPI card.
- Sample products have no photos, so the real image placeholder remains visible; no fabricated images/data were added.
- Existing `npm audit` reports five high-severity dependencies: brace-expansion, follow-redirects, source-map-js, vite and zod. No unrelated dependency upgrade was attempted; review separately before release.
- Dashboard seed cleanup must follow Dashboard review sample cleanup when demo reviews reference its users/products. Foreign keys prevent unsafe removal; no cleanup schema changes were made.

No newly observed backend functional regression was found in the executed integration suites. Visual completion and any subsequent commit/push/merge remain separate next steps.

## UI-only commit review — 2026-11-01

Reviewed the actual diff of the ten files listed above against cleanup commit `e48ce1f`.
All changes are presentation/accessibility improvements or the necessary Admin Products load-error presentation fix. No backend, API, authorization, product filtering/deletion, cart/order/payment or review moderation business rules changed.

- ProductDetail moves reviews/Q&A ahead of recommendation shelves; existing `#reviews` ID and scroll effect remain unchanged.
- Admin Products retains API requests, active filtering, unmount guards and delete behavior. The new regression test verifies a rejected list request shows an alert rather than a false empty state.
- Admin Reviews uses existing visibility badges and a dedicated responsive analytics grid; tab/filter/API behavior is unchanged.
- Cart resets only the mobile table minimum width. No overflow-hiding workaround was added.
- Dashboard changes only refresh-button selector specificity, not chart rendering or data.
- Engagement/refinement CSS scopes sizing, wrapping and focus styles to relevant components/admin pages. Global border-box sizing already exists; admin width includes padding. Wide tables retain local scrolling.
- Theme changes only catalog price-input spinner appearance; keyboard/manual numeric input remains available.

Fresh verification: `npm run lint` PASS; `npm test` PASS (117 tests, 16 files); `npm run build` PASS. Existing ~597 kB main-chunk warning remains. Backend was not rebuilt for this frontend-only commit review.

No new browser visual pass was performed. Pending viewport/hash/keyboard/chart checks listed above remain limitations, not PASS results. The user explicitly requested committing the reviewed UI-only patch after automated checks; this does not declare the full visual audit complete or authorize pushing/merging. The unrelated payment worktree was not opened, inspected or modified.
