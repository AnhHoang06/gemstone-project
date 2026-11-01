# Optional local demo-catalog repair

Run only against the development database containing the old generated demo dataset:

```powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -v DemoCleanupConsent=LOCAL_SAMPLE_DATA -i backend/GemstoneShop/GemstoneShop/Database/DemoCatalogCleanup.sql
```

No schema changes. Transactional and repeatable: missing/ambiguous real roots, unmapped products, non-demo image references, or legitimate children under generated categories abort the transaction.

- Reuses existing Ruby, Sapphire, Emerald, Diamond and Amethyst root categories.
- Recognizes generated rows by exact ReviewDemo_v1 / DashboardSeed_v1 markers, never fixed IDs.
- Reclassifies six unsupported review-demo gemstone names, preserving product IDs and review/order/history references; cleans all twelve review-demo product names.
- Removes only empty, marker-owned legacy category branches after reassigning their products.
- Preserves historical OrderDetails product-name/price snapshots.
- Hides only the old explicit test fixture matching both Name=`Ruby Test` and Description=`Test product`; never deletes it.
- Removes only the exact fifteen former Codex WebP paths on marked demo products. Original uploads, pre-existing SVG assets, branding and all unrelated image references remain untouched.
- Does not add replacement images. Existing no-image placeholders remain in use.

Applied locally: 76 demo products reassigned (12 renamed), 13 generated categories removed, 53 demo image rows removed, one explicit test product hidden. Second run: all change counts zero. Fifteen verified WebP files plus their three source/attribution files were removed, as were the old DemoProductImages seed/cleanup/readme, verification test and report; Footer attribution was reverted.

Two original image references were already missing from this checkout before cleanup and were preserved:
- `/uploads/products/2/5274c379b3c744b7b335187156b67558.jpg`
- `/uploads/products/27/358746e5020445f19176276a3714b016.jpg`

Future seeds: DashboardSampleData.sql and ReviewSampleData.sql require existing roots; SampleData.sql uses existing matching categories or the nearest resolved ancestor, skipping unsupported families. They create no categories. Cleanup scripts never delete the reused real roots. Dashboard review cleanup must precede dashboard seed cleanup. Keep demo seed execution optional; do not run cleanup scripts on production.

Verification: backend build, frontend lint/build and 117 React tests passed. Catalog integration passed (hierarchy, uniqueness, cycles/depth, ancestor visibility, Vietnamese search, pagination and restart backfill). Dashboard API aggregates matched SQL for All, two categories and three products. Fresh Dashboard/Review seed creation and their cleanup were exercised inside an outer transaction and rolled back; all five real categories remained identical. No browser visual PASS is claimed: this session's localhost browser access remains unavailable.
