# Admin sales analytics

Branch: feature/admin-analytics-dashboard. Base: develop 7763d7a. No schema changes.

## Reporting rule (not a payment workflow)

An OrderDetail qualifies only when its Order has Status.Name = Completed **and** PaymentStatus = Paid.
Revenue = SUM(OrderDetails.UnitPrice * Quantity), using historical price snapshots, never current Product.Price.
Units = SUM(Quantity). Completed orders = COUNT(DISTINCT OrderId). Average = filtered revenue / distinct qualifying orders (zero for no orders).
Filtering a category/product counts only matching lines of mixed orders, not their full Order.TotalAmount.

All date filters apply to Order.CreatedAt in UTC, inclusive start/end dates (SQL half-open timestamps).
This is an order-creation cohort report, NOT cash-flow or completion-date accounting.
The existing app creates Unpaid orders and has no reconciliation UI. This feature does not mark anything Paid,
infer payment from Completed/COD, or change payment semantics. Empty reports are expected until qualifying data exists.

Historical inactive products/categories remain included. Category grouping and display names use current product/category metadata
because OrderDetails has no category snapshot. OrderDetails.ProductName/UnitPrice are not modified; monetary values come from UnitPrice.
Moving products between categories changes historical categorization; a future historical taxonomy needs an explicit schema decision.

## API

Both new endpoints require Admin JWT; existing /api/dashboard/summary is untouched.

- GET /api/dashboard/analytics/options: minimal category/product filter metadata, including inactive rows and ancestry.
- GET /api/dashboard/analytics?range=30d&categoryId=...&productId=...
- range: 7d, 30d (daily), 3m (weekly), 6m, 1y (monthly), custom.
- custom requires start/end YYYY-MM-DD, start <= end, no future end, at most 366 inclusive days.
- non-custom queries reject start/end. Invalid inputs: 400. Missing category/product: 404. Incompatible category/product: 400.
- Parent selection includes all descendants through the shared CatalogQueries.InCategory predicate (up to three schema-supported levels).
  CatalogController now calls that exact extracted predicate; storefront behavior is unchanged.
- Selecting a product without a category uses its immediate category for the comparison context.
- summary and trend respect all filters; breakdown intentionally ignores productId to retain comparison.
- All-category breakdown groups by root category exactly once; selected-category breakdown groups by product across its subtree.
- Percentages are computed from the selected breakdown metric on the frontend; raw order/detail rows are never sent.
- Weekly buckets start at the selected range start. Monthly buckets are clipped at range edges. Empty periods are zero-filled.
- SQL performs sums and distinct counts. At most 366 daily aggregate rows are combined into chart buckets in the backend.
- Short SERIALIZABLE read transaction keeps KPI/trend/composition mutually consistent. At large scale, read snapshots/indexing
  should be evaluated to reduce contention; no isolation settings or schema have been changed globally.

DTOs: DashboardAnalyticsQuery, DashboardAnalyticsDto, AnalyticsFilters, AnalyticsSummary, AnalyticsBucket, AnalyticsSlice.

## Frontend

AdminDashboard: filters, four KPI cards, explicit reporting notes, loading/error/retry/empty states.
AnalyticsCharts: line metric selector, donut metric selector, slice drill-down, interactive accessible legend,
selected-product border/offset/text emphasis, data table alternative to canvas. Metric selections survive filter changes.
Existing useApiData/session-aware Axios rejects stale responses; no auth/session/provider changes.

Only Chart.js (+ its color dependency) added. Only needed controllers/elements/scales are registered.
Charts are lazy-loaded separately (~169 kB minified / 59 kB gzip); no wrapper or date adapter library.
Official integration/accessibility guidance:
https://www.chartjs.org/docs/latest/getting-started/integration.html
https://www.chartjs.org/docs/latest/general/accessibility.html
Animations are disabled, including for reduced-motion users. Keyboard users can drill down using normal legend buttons.

## Verification

- Backend requested dotnet build: PASS, 0 warnings/errors.
- Frontend full lint, build: PASS (existing main-bundle >500 kB warning).
- React: 78 tests / 13 files PASS, including eight new dashboard tests.
- Existing person3, wishlist, payment, catalog, product-removal integration suites: PASS.
- New analytics integration: PASS (authorization; all/category/descendant/product; paid-completed rule;
  distinct orders; snapshot prices; units/AOV; inactive history; date boundaries; zero buckets;
  daily/weekly/monthly grouping; mismatch/invalid inputs; legacy summary).
- Temporary local SQL fixtures are created and cleaned in finally. No production seed/demo data is added.
- Browser verification and screenshots: see images in this directory; fixtures intentionally use test-labelled names.

Run API locally using Development configuration and an existing database with the five baseline SQL scripts applied.
Run node tests/analytics.integration.mjs with PERSON3_API_URL / PERSON3_SQL_SERVER / PERSON3_SQL_DATABASE
targeting that same local database. Do not run fixture tests on production/shared data.

Optional screenshots: set ANALYTICS_SCREENSHOTS=1, ANALYTICS_FRONTEND_URL=http://localhost:2222,
and PLAYWRIGHT_MODULE to a locally installed Playwright module URL (Edge required).
The script verifies all categories → root → product against real API data, saves 1366/390 screenshots,
checks the selected KPI/context, JavaScript errors and mobile overflow, then cleans fixtures.

## Screenshots
- [All categories, 1366px](all-1366.png)
- [Selected product, 1366px](product-1366.png)
- [Selected product, 390px](product-390.png)

Browser test confirmed 10,500,000 total revenue → 9,000,000 Ruby subtree → 3,000,000 Ruby Star.
The product view retains the 9,000,000 category comparison; the selected product contributes 33.3%.
All values come from temporary database fixtures (Test-prefixed labels), not frontend mocks.

Dependency audit reports five high-severity packages already present in the baseline lockfile:
brace-expansion, follow-redirects, source-map-js, vite, zod. No advisory is reported for chart.js or @kurkle/color.
Dependency remediation is separate from this feature.
