# Dashboard sample data (local development only)

## Files
- DashboardSampleData.sql: creates deterministic, isolated DashboardSeed_v1 records.
- DashboardSampleDataReport.sql: read-only counts, distributions and integrity checks.
- DashboardSampleDataCleanup.sql: removes only marked sample records; aborts if externally referenced.
- ../../../../../tests/dashboard-seed.verify.mjs: SQL/API/browser verification of an existing seed.

No database tables/columns, app logic, real orders, products or customers are changed.
Apply the existing Person3/Wishlist/Payment/CategoryHierarchy/ProductSearch schema scripts beforehand.

## Run
From repository root, against your **local development database**:

~~~powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -v DashboardSeedConsent=LOCAL_SAMPLE_DATA SeedAsOf=2026-10-29 -i backend/GemstoneShop/GemstoneShop/Database/DashboardSampleData.sql
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -W -s '|' -i backend/GemstoneShop/GemstoneShop/Database/DashboardSampleDataReport.sql
~~~

Choose an explicit non-future UTC anchor date. SHA-256-derived pseudo-random choices and that anchor make
the dataset deterministic (identity IDs may differ). A complete existing seed is a no-op, even with a
different anchor. To regenerate for another date, explicitly clean first. Partial seeds fail without overwriting data.
The transaction and application lock prevent partial/overlapping seed runs.

For the full generated period, choose Dashboard → Tùy chọn → 2025-10-29 through 2026-10-28.
The default Last 30 days intentionally shows only a small recent subset.
A rolling 12-month interval intersects 13 calendar labels; the first/last chart buckets are partial.

## Identification and safety
- Reuses existing Ruby/Sapphire/Emerald/Amethyst roots; creates zero categories. Missing/ambiguous roots fail closed.
- Product Description and Order.Note carry the exact DashboardSeed_v1: prefix.
- Customer emails are dashboardseed.v1.NNN@example.invalid; addresses also carry the marker.
- Customer names are synthetic combinations, not copied personal data. Phone 0000000000 is intentionally
  non-dialable; addresses explicitly say they are simulated and must not be used for delivery.
- All 120 seed customers are disabled. Their BCrypt hash comes from a discarded random secret; no usable password is published.
- Products are active for local browsing, with realistic attributes and remaining stock. They have no invented
  certificates/images. Remaining stock is a synthetic current balance, not a reconstruction of purchases.
- OrderDetails copy names and historical unit prices (95–105% of current price), generally quantity 1.
- No separate Payments table exists: all 1,062 orders use the existing PaymentMethod/PaymentStatus/PaidAt columns.
- Completed orders are Paid; cancelled orders are Unpaid with no PaidAt. Some confirmed/shipping BankTransfer
  orders are already Paid, but do not qualify as completed revenue. Dates are chronological.
- No CheckoutReceipts are fabricated: these are historical SQL fixtures, not replayable checkout requests.
- Old orders are settled or cancelled. Open orders are restricted to the recent 14 days. Therefore Completed
  is 88.51%, intentionally above the illustrative 55–70% range to avoid implausible year-old pending shipments.

## Cleanup
~~~powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -v DashboardSeedConsent=LOCAL_SAMPLE_DATA -i backend/GemstoneShop/GemstoneShop/Database/DashboardSampleDataCleanup.sql
~~~

Cleanup checks exact markers and relationships. If a real order/cart/wishlist or an uploaded image/certificate
references a seeded product, it aborts rather than deleting that data. It never disables FK constraints,
cascades deletions, or uses a reserved identity-ID range. Do not remove/edit markers if you want automatic cleanup.
The cleanup was tested inside an outer rollback transaction: 120 users, 12 categories, 64 products,
1,062 orders and 1,777 details were selected for deletion, then all restored by rollback.

## Verified results — anchor 2026-10-29
| Metric | Value |
|---|---:|
| Customers | 120 |
| Categories | 12 (4 parents + 8 children) |
| Products | 64 |
| Orders | 1,062 |
| OrderDetails | 1,777 |
| Payment-bearing orders | 1,062 |
| Paid orders | 945 (940 Completed + 5 other states) |
| UTC range | 2025-10-29 09:44 to 2026-10-28 19:29 |
| Minimum order | 1,000,000 VND |
| Maximum order | 57,820,000 VND |
| Average order | 13,188,323.92 VND |
| Qualifying Completed + Paid revenue | 12,845,900,000 VND |
| Qualifying orders / units | 940 / 2,021 |
| Qualifying average order | 13,665,851.06 VND |

Yearly revenue is a sum of many realistic orders, not billion-value individual products/orders.
Maximum order is about 4.38× average. Most full calendar months have 66–101 orders with a modest upward trend.
1,433 lines have quantity 1; 279 have 2; 47 have 3; 18 have 4.

| Status | Count |
|---|---:|
| Completed | 940 |
| Cancelled | 86 |
| Confirmed | 14 |
| Pending | 12 |
| Shipping | 10 |

COD: 611 orders; BankTransfer: 451.
Root revenue shares: Ruby 48.49%, Sapphire 28.88%, Emerald 19.41%, Amethyst 3.23%.
Top product: Ruby Huyết Bồ Câu Oval 0,65 ct — 5.11% globally, 10.53% of Ruby.
No single product dominates the chart. SQL integrity report: 0 invalid orders.

## Verification
- Seed execution and second-run idempotency: PASS; existing rows were not overwritten.
- Cleanup selection tested with outer rollback: PASS; dataset retained.
- SQL/API all/categories/products comparisons: PASS.
- Real browser: All, Ruby, Sapphire, two Ruby products and one Sapphire product: PASS.
- KPI revenue, distinct order count, units, AOV and line totals match independent SQL aggregation.
- Product donut retains all 16 siblings; selected-product highlight works.
- Desktop 1366 and mobile 390: no horizontal page overflow or JavaScript errors.
- Screenshots: docs/admin-analytics/seed/ (All, two categories, one desktop and one mobile product view).
- With 16 products the existing legend is long; this seed task does not redesign that UI.

Run API on http://localhost:5117 and frontend on http://localhost:2222 with VITE_API_BASE_URL matching the API.
~~~powershell
$env:PERSON3_API_URL='http://localhost:5117'
node tests/dashboard-seed.verify.mjs
~~~
Optional browser checks: ANALYTICS_SCREENSHOTS=1, ANALYTICS_FRONTEND_URL=http://localhost:2222,
PLAYWRIGHT_MODULE=file:///absolute/path/to/playwright/index.mjs (Edge installed).
The verifier creates and removes one temporary admin only; it leaves persistent seed data untouched.

Existing old seeds: run DemoCatalogCleanup.sql once (repeatable) before rerunning seeds. Cleanup scripts delete only marker-owned categories, never the reused real roots.
