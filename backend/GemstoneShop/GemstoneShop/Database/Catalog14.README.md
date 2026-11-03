# Catalog14 demo rebuild (local only)

Source: user-provided `anh-da-quy-da-doi-ten.zip`. Exactly 14 distinct images, no web downloads. Existing five category roots only. No schema/API/business changes.

## Applied result — 2026-11-03

- Before: 80 products, 76 active. After: 83 products, **14 active**, 69 inactive.
- Reused 11 suitable unadopted DashboardSeed product IDs; created 3 products. No product/category/user rows deleted.
- Removed 1,082 positively identified old generated orders and 573 generated reviews (dependent seed votes first). Preserved original product images, historical Q&A, external carts/favorites and all non-seed orders.
- Created 80 disabled demo customers, 564 orders, 932 order details, 173 verified-purchase reviews, 325 helpful votes, 14 unanswered product questions.
- Payments use existing Order columns; no separate Payment table or fabricated payment records.
- 502 Completed+Paid orders, 46 Cancelled, 9 Shipping, 3 Confirmed, 4 Pending. Old orders have settled; open orders are restricted to recent dates.
- New order range: 2025-11-05 to 2026-11-02 (12 rolling months).
- Order totals: min 1,140,000; max 50,890,000; mean 10,940,709.22 VND.
- Completed+Paid revenue: 5,609,600,000 VND; units 1,033; AOV 11,174,501.99 VND.
- Largest category Diamond: 1,605,130,000 VND (~28.61%). Largest product Diamond Giọt Nước: 973,330,000 VND (~17.35%).
- Final database: 575 orders, 173 reviews. All 14 public products have 8–18 reviews, averages calculated from actual rows, not stored fake stars.

## Mapping

| ID | Product | Asset under `/catalog-gems/` |
|---|---|---|
|135|Ruby Oval|ruby-oval.jpg|
|138|Ruby Đỏ Cushion|ruby-cushion.jpg|
|137|Ruby Giọt Nước|ruby-pear.jpg|
|156|Sapphire Xanh Marquise|sapphire-marquise.jpg|
|151|Sapphire Xanh Oval|sapphire-oval.jpg|
|157|Sapphire Trái Tim|sapphire-heart.jpg|
|168|Emerald Tròn|emerald-round.jpg|
|171|Emerald Bát Giác|emerald-octagon.jpg|
|167|Emerald Oval|emerald-oval.jpg|
|186|Amethyst Cushion|amethyst-cushion.jpg|
|185|Amethyst Giọt Nước|amethyst-pear.jpg|
|554|Amethyst Trillion|amethyst-trillion.jpg|
|555|Diamond Giọt Nước|diamond-pear.webp|
|556|Diamond Round Brilliant|diamond-round.webp|

IDs above describe this local application, not portable fixture IDs. Identity counters advance during rollback rehearsals. Assets are served by the backend (the existing frontend URL resolver prefixes the API origin). AVIF converted to WebP without cropping or replacing the image. Checksums are in Catalog14Assets.json. Some supplied photos have branding; no web reuse license is asserted. Sapphire heart is only 225x225. Carat/origin/certification are not guessed from photographs.

## Protection

Orders **2548, 2658, 2709, 2710, 2712** are copied in full (including all current payment columns), with OrderDetails and CheckoutReceipts, before any write. JSON snapshots and comparisons must match before COMMIT. All other non-seed Orders/OrderDetails are also compared. Their products **136, 223, 224, 225** remain with the same IDs, now inactive. They are not used in new generated orders. Inactive originals 1, 2, 27 and separate QR fixture 529 are preserved.

Remaining old generated products are kept inactive, rather than risking external references. Original image files and references are untouched. FK constraints stay enabled; DBCC CHECKCONSTRAINTS passed. Reviews are generated only from new completed paid purchase history.

## Execution

Use the backend Database folder as input location. This is a **local migration for the inspected database**, requiring the five protected order IDs. It deliberately refuses a different DB/partial state. Do not run blindly on a teammate's production/shared database.

```powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -v CatalogConsent=LOCAL_SAMPLE_DATA SeedAsOf=2026-11-03 Apply=0 -i Catalog14Rebuild.sql
# Only after the rollback rehearsal passes:
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -v CatalogConsent=LOCAL_SAMPLE_DATA SeedAsOf=2026-11-03 Apply=1 -i Catalog14Rebuild.sql
```

A rerun detects Catalog14 and fails closed before mutations instead of duplicating records. The legacy DashboardSampleData, ReviewSampleData, DashboardReviewSampleData and SampleData scripts have been removed from the repository; the old datasets must not be reseeded alongside this one.

Optional `Catalog14Cleanup.sql` uses the same consent and Apply=0/1 switches. It deletes only scoped generated order/review/question records after external-adoption guards and makes generated products inactive. It retains product IDs, images and disabled users to preserve potential external references. It does **not** restore old demo data or enable an automatic reseed; inspect retained state before any further rebuild.

## Verification

- Full rebuild rehearsal with rollback twice: PASS; real application: PASS.
- Optional cleanup rollback: PASS (no persisted cleanup).
- Backend build: PASS, zero warnings/errors.
- Frontend full lint/build: PASS; 177 React tests PASS. Existing >500 kB bundle warning remains.
- catalog, person3, payment, analytics, reviews/Q&A, product-removal, wishlist: PASS before and after application; fixtures cleaned.
- `PERSON3_API_URL=http://localhost:5140 node tests/catalog14.verify.mjs`: validates public product set, 14 real image URLs/details, seeded order bounds and dashboard API against independent SQL (All, 2 categories, 3 products).
- Current presentation backend on port 5136 also serves all 14 images with HTTP 200. A local deployment copy of the assets was placed in `.payment-qr-worktree/.../wwwroot/catalog-gems`; payment source code unchanged. Do not accidentally stage that separate worktree.
- Browser visual rendering at desktop/mobile was not checked; do not label this visual PASS. API/image decoding checks do not prove card layout.
- No commit/push/merge performed. Unrelated pending dashboard/payment/shipping work preserved.

### Pre-existing missing files

Two untouched inactive original products have image paths with no corresponding file in this workspace:
- Product 2: `/uploads/products/2/5274c379b3c744b7b335187156b67558.jpg`
- Product 27: `/uploads/products/27/358746e5020445f19176276a3714b016.jpg`

These predate this task, are outside the 14 public products, and were not cleared/replaced. No new broken image reference was introduced.
