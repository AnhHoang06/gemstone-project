# Catalog rebuild: image mapping and preflight

Date: 2026-11-03. Safe plan approved; rollback rehearsal and local application completed. See Catalog14.README.md for execution/results.

The current source is `C:/Users/dhaca/Downloads/anh-da-quy-da-doi-ten.zip`, replacing the previous RAR. The ZIP contains exactly 14 images. Visual inspection confirms three Ruby, three Sapphire, three Emerald, three Amethyst, and two Diamond images. Existing category IDs are 1 Ruby, 2 Sapphire, 3 Emerald, 4 Diamond, 5 Amethyst. These are inspection findings, not IDs to hard-code in portable seed scripts.

| Source filename | Proposed product | Existing category | Normalized asset filename |
|---|---|---|---|
| ruby-oval.jpg | Ruby Oval | Ruby | ruby-oval.jpg |
| ruby-cushion.jpg | Ruby Đỏ Cushion | Ruby | ruby-cushion.jpg |
| ruby-pear.jpg | Ruby Giọt Nước | Ruby | ruby-pear.jpg |
| sapphire-marquise.jpg | Sapphire Xanh Marquise | Sapphire | sapphire-marquise.jpg |
| sapphire-oval.jpg | Sapphire Xanh Oval | Sapphire | sapphire-oval.jpg |
| sapphire-heart.jpg | Sapphire Trái Tim | Sapphire | sapphire-heart.jpg |
| emerald-round.jpg | Emerald Tròn | Emerald | emerald-round.jpg |
| emerald-octagon.jpg | Emerald Bát Giác | Emerald | emerald-octagon.jpg |
| emerald-oval.jpg | Emerald Oval | Emerald | emerald-oval.jpg |
| diamond-pear.avif | Diamond Giọt Nước | Diamond | diamond-pear.webp |
| diamond-round.webp | Diamond Round Brilliant | Diamond | diamond-round.webp |
| amethyst-cushion.jpg | Amethyst Cushion | Amethyst | amethyst-cushion.jpg |
| amethyst-pear.jpg | Amethyst Giọt Nước | Amethyst | amethyst-pear.jpg |
| amethyst-trillion.jpg | Amethyst Trillion | Amethyst | amethyst-trillion.jpg |

Names describe appearance only. Photos do not establish origin, carat, authenticity, or certification. Some provided photos contain branding; sapphire-heart.jpg is only 225x225. All 14 assets are served from `backend/GemstoneShop/GemstoneShop/wwwroot/catalog-gems/`. The AVIF was converted to WebP because the current backend returned 404 for AVIF. All 14 live image URLs returned HTTP 200. ProductImages assignments are applied.

## Database classification

80 current products, 76 active:

- 64 DashboardSeed_v1 products (IDs 135–198): confirmed generated product provenance. Related records still require individual provenance checks.
- 12 ReviewDemo_v1 products (IDs 214–225): confirmed generated product provenance. Related records still require individual provenance checks.
- IDs 1, 2, 27: inactive pre-existing records; preserve, including original image references.
- ID 529: separate QR presentation fixture, inactive; preserve.

Do not infer order provenance from product provenance.

## Protected non-seed order references — safe plan approved

These orders lack the expected DashboardSeed_v1/ReviewDemo_v1 note marker:

| Order | Status | Referenced product |
|---|---|---|
| 2548 | Cancelled | 225 Amethyst Oval |
| 2658 | Cancelled | 224 Diamond Princess |
| 2709 | Cancelled | 225 Amethyst Oval |
| 2710 | Cancelled | 224 Diamond Princess |
| 2712 | Pending | 136 Ruby Huyết Bồ Câu Tròn 0,80 ct |
| 2712 | Pending | 223 Diamond Round |

The user explicitly approved preserving all five orders and their OrderDetails, totals, payment fields and history unchanged. Keep their referenced Products in the database; products outside the new catalog may be made inactive. Only independently verified generated data may be removed. Use exactly 14 images and 14 active catalog products (3 Ruby, 3 Sapphire, 3 Emerald, 3 Amethyst, 2 Diamond).

Cleanup/reseed must first run in a rollback transaction and verify protected order snapshots before any permanent application. The rebuild ran twice with rollback, then applied locally with identical preservation assertions. All required integration suites, lint, build and 177 React tests passed. No commit, push or merge occurred. Browser visual checks were not performed; API/image checks are not a visual PASS.
