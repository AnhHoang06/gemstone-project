# Catalog redesign — deployment and review

## Scope

- Three-level category hierarchy, sibling-scoped names, ordered public tree and parent-aware visibility.
- Paginated server catalog, Vietnamese accent-insensitive search and compact product DTO.
- Gold navigation/mega menu, centered Gem Aurelia branding, responsive drawer; real category data only.
- Warm home hero, root category ribbon, newest-product scroll-snap carousel (one card per step).
- URL-driven shop filters, category breadcrumbs, pagination and debounced accessible search suggestions.
- Shared cards/gallery placeholders, wishlist/detail search, navy footer with empty verified-contact configuration.
- Category parent/sort editing, tree display, admin product category selectors. Products hidden by category remain manageable by admins; soft-deleted products stay excluded from normal admin editing/listing.
- Legacy `/products` and `/products/:id` redirect with replacement to `/shop` and `/product/:id`, preserving query strings. Obsolete duplicate pages and mock products removed.

Cart/Order/Payment/Wishlist/Auth/SignalR transaction, session and event mechanisms are retained. The only commerce endpoint changes apply the approved shared category visibility predicate to cart mutations, wishlist reads/adds and conditional checkout stock updates.

## Database First deployment

Run existing `Person3.sql`, `Wishlist.sql`, `Payment.sql`, then:

1. `backend/GemstoneShop/GemstoneShop/Database/CategoryHierarchy.sql`
2. `backend/GemstoneShop/GemstoneShop/Database/ProductSearch.sql`

Use `sqlcmd -d <configured database> -b`; scripts do not issue `USE`. Both new scripts were rerun successfully against the existing local database. They are transactional, additive and preserve products, orders and references. Apply before deploying the matching API; use a maintenance window because the old API still assumes global category-name uniqueness.

`Category.Hierarchy.cs`, `Product.Search.cs`, and `Data/CategoryHierarchyContext.cs` extend the scaffold through the one existing `OnModelCreatingPartial` implementation. **No scaffolded model/context file was edited and old unique-index EF metadata was not rewritten**. An integration test creates identically named children under different parents successfully, confirming the old metadata does not affect runtime inserts. Do not use EF migrations/EnsureCreated to deploy this Database First schema.

SQL Server `Vietnamese_CI_AI` did not treat `đ` as `d` in the local probe. Therefore search uses `SearchName`: SQL backfills precomposed Vietnamese, API create/update normalizes Unicode, removes combining marks and maps `đ/Đ` to `d`. If products are imported/renamed outside the API, rerun `ProductSearch.sql` afterward (normalize decomposed imported names first). Search currently uses substring matching and has no full-text index.

## APIs

- **New** `GET /api/categories/tree`: active nodes whose ancestors are active; nested children sorted by SortOrder/Name.
- `GET /api/categories[/{id}]`: public visibility; `includeInactive=true` requires Admin, otherwise 403.
- Category POST/PUT: optional `parentId`, `sortOrder` (default 0); reject missing parent, cycles, depth >3 (including moved subtrees), sibling duplicates. SQL transaction-owned lock serializes hierarchy mutations across API instances. DELETE blocks children and products.
- **New** `GET /api/products/catalog?q=&categoryId=&minPrice=&maxPrice=&sort=&page=&pageSize=`: `{items,total,page,pageSize,totalPages}`; descendants included, stable sorting, validated nonnegative prices/page sizes. Default page 1, size 12, max 48. DTO excludes unnecessary entities.
- Existing `/api/products` shape remains unchanged. Public list/detail now honor active ancestors; admin can opt into inactive visibility. Cart/wishlist/checkout reject hidden products.

## Verification

- Backend build: PASS, 0 warnings / 0 errors.
- Frontend production build and full lint: PASS.
- React suites: **70 tests / 12 files PASS** (two workers; no skipped tests). Includes existing session/cart/checkout/order/payment/wishlist tests and new catalog/search/carousel/redirect/mega-menu/category-form tests.
- All five integration suites: PASS (`person3`, `wishlist`, `product-removal`, `payment`, `catalog`). Fixtures cleaned.
- Catalog integration verifies sibling uniqueness with unchanged scaffold metadata, tree/cycle/depth validation, ancestor visibility and checkout rejection, unaccented `da quy`, `kim cuong`, `đ/ư/ơ/ă/â`, parent filtering, pagination and invalid parameters.
- Existing commerce integration verifies concurrent cart increments, last-stock race, checkout replay/rollback, one-time cancellation restocking, ownership, existing-JWT revocation and established SignalR connection revocation.

## Visual review

Screenshots use disposable, clearly labelled local test products (not production seed data), then remove fixtures. No auth state/secrets are saved. The supplied document referenced two inspiration images but they were not attached; implementation follows the written specification.

| Page | Before desktop | After desktop | Before mobile | After mobile |
|---|---|---|---|---|
| Home | [1366](before/home-1366.png) | [1366](after/home-1366.png) | [390](before/home-390.png) | [390](after/home-390.png) |
| Shop | [1366](before/shop-1366.png) | [1366](after/shop-1366.png) | [390](before/shop-390.png) | [390](after/shop-390.png) |
| Filtered | [1366](before/filtered-1366.png) | [1366](after/filtered-1366.png) | [390](before/filtered-390.png) | [390](after/filtered-390.png) |
| Product detail | [1366](before/detail-1366.png) | [1366](after/detail-1366.png) | [390](before/detail-390.png) | [390](after/detail-390.png) |
| Admin categories | [1366](before/admin-categories-1366.png) | [1366](after/admin-categories-1366.png) | [390](before/admin-categories-390.png) | [390](after/admin-categories-390.png) |

Additional checks: [desktop mega menu](after/menu-1366.png), [mobile menu](after/menu-390.png), [mobile filters](after/filters-390.png). All ten final page/viewport combinations have no horizontal page overflow; menus, Escape and legacy category URLs were also exercised in Edge.

Reproduce: install Playwright externally if needed (not a project dependency), set `PLAYWRIGHT_MODULE` to its module path, and run `node tests/catalog.screenshots.mjs after` with Edge, local SQL and API/frontend ports 5113/2222. This fixture script targets only that local setup.

## Remaining limitations

- No featured flag: carousel intentionally uses newest 12 products.
- No new product photos or externally downloaded images; placeholders remain until the team uploads real photos.
- Contact/social configuration starts empty; four informational routes are placeholders.
- Fonts use the existing Google Fonts approach plus Vietnamese-capable Oswald; offline uses Vietnamese-capable body fallback.
- Existing Vite >500 kB bundle warning remains; no dependency or chart/carousel library added.
- Search is suitable for the current university-project catalog; large-scale indexing/caching is outside scope.
