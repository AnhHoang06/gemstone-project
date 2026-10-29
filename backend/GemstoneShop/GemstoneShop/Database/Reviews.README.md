# Product reviews & engagement

## Deploy
1. Apply existing baseline scripts (Person3, Wishlist, Payment, CategoryHierarchy, ProductSearch).
2. Apply Reviews.sql to the target database **before** starting this backend version.
3. Deploy API + frontend. Back up SQL and App_Data/review-images together.

Reviews.sql is additive and transaction-protected with an application lock. Re-running it leaves data intact.
It adds ProductReviews, ReviewImages, ReviewHelpfulVotes, ProductQuestions and ProductAnswers.
All FKs use NO ACTION. No scaffold-generated file was edited: ReviewsContext extends the existing partial hook.
Unique constraints enforce one user/product review, one user/review vote, one answer/question, and three image
slots per review. Rating is constrained to 1–5; content is required and limited to 2,000 characters.

## Purchase / moderation rules
- JWT user identity and Customer role required for creating/editing reviews, images and questions.
- A qualifying purchase is **any OrderDetail for this ProductId on an Order owned by this JWT user whose
  OrderStatus.Name is Completed**. Payment status and current product visibility do not change this historical rule.
- VerifiedPurchase is derived in the query, never accepted/stored from the client.
- POST conflicts if already reviewed; PUT updates content/rating and UpdatedAt, preserving CreatedAt and IsVisible.
- The author can edit a hidden review, but cannot restore it. Admin only changes visibility/ModeratedAt.
- Public list, summary and images exclude hidden reviews and products failing the existing PubliclyVisible predicate.
- Author/admin can retrieve private images with an authenticated request. No customer email/phone/address in review DTOs.
- Helpful PUT/DELETE are idempotent desired states, not non-idempotent toggles. The UI chooses based on server state.
  Self-votes and votes on hidden/non-public reviews are rejected.
- DB transaction application locks serialize creation per user/product and image/vote/moderation operations per review.
  SQL constraints remain the final guard across API instances using the same database.

## Routes
Public:
- GET /api/products/{id}/reviews?rating=1..5&sort=newest|highest|lowest|helpful&page=1&pageSize=10 (max 50)
- GET /api/products/{id}/questions?page=1 (10/page)
- GET /api/review-images/{id} (visibility/ownership checked, private/no-store)
- GET /api/products/{id}/related (4 cards)
- GET /api/products/top-rated (up to 4)
- GET /api/products/recent?ids=1,2 (max 12, public products only, preserves requested order)

Customer:
- GET /api/products/{id}/reviews/me (eligibility and own review, including hidden/inactive history)
- POST /api/products/{id}/reviews; PUT /api/products/{id}/reviews/me
- POST /api/reviews/{id}/images (multipart files); DELETE /api/reviews/{id}/images/{imageId}
- POST /api/products/{id}/questions

Authenticated:
- PUT /api/reviews/{id}/helpful; DELETE /api/reviews/{id}/helpful

Admin:
- GET /api/admin/reviews?search=&rating=&visible=&page=1 (20/page)
- PUT /api/admin/reviews/{id}/visibility {isVisible}
- GET /api/admin/questions?search=&visible=&page=1 (20/page)
- PUT /api/admin/questions/{id}/visibility {isVisible}
- PUT /api/admin/questions/{id}/answer {content}
- GET /api/admin/reviews/analytics?from=&to= (UTC, inclusive from/exclusive to)

## Ranking / analytics
Related: same category first, then same root category family (existing maximum 3 levels), then other categories;
within each group order by absolute price difference, then ID. Excludes current/non-public products.
Top rated: minimum **3 visible reviews**, average descending, count descending, product ID ascending.
No fake fallback ratings; insufficient data shows an honest empty state.
Admin review analytics uses visible reviews only for rating metrics and separately reports global hidden count.
Date filters apply to review CreatedAt. High/low rankings require 3 reviews in the selected period.
Inactive products remain part of historical admin review analytics. No changes to sales dashboard APIs.

## UI
- Product detail: related cards, rating summary/distribution, own form, server-side sorting/filter/pagination,
  helpful votes, Q&A, recently viewed.
- /review-product/:id: protected historical review form, reachable from Completed customer order details.
  Other order states and Admin order details have no customer review CTA.
- /admin/reviews: reviews, questions/answers, focused analytics tabs. Existing AdminRoute.
- Home: real top-rated block. Catalog/detail show actual low stock only when 1–3.
- Recent product IDs only in localStorage, max 12, deduplicated; server removes unresolved/hidden entries.
  Authentication changes clear that local history; it is not synced to accounts/server.
- Session-keyed forms and existing Axios stale-session guard prevent cross-account response leakage.

## Images / limitations
Optional 0–3 PNG/JPEG/WebP files, each <=5 MB; request <=16 MB. Server inspects binary signatures,
ignores original filenames, creates GUID filenames, and stores files outside wwwroot in App_Data/review-images.
Serving uses fixed image MIME + nosniff, no-store, and DB visibility/ownership authorization.
This is signature validation, not full image decoding/re-encoding or malware scanning.
Separate review-text and image requests: an image failure may leave successfully saved text; retry edits that same
review instead of creating a duplicate. UI reports partial failure and retains selected files.
Files are written before DB commit; failed pre-commit writes are removed. An ambiguous commit timeout can leave
a private orphan file. Offline orphan reconciliation/antivirus and distributed storage are not included.
For multiple API instances, a shared private upload volume is needed; SQL concurrency works across instances,
but local disk is not automatically replicated.
No realtime review events; users reload or change filters to see moderation from another session.

## Optional demo (never production schema)
ReviewSampleData.sql requires SQLCMD variables ReviewSeedConsent=LOCAL_SAMPLE_DATA and SeedAsOf=YYYY-MM-DD.
Creates 12 labeled products, one category, 20 disabled synthetic customers, one disabled synthetic Admin,
20 Completed/Paid historical orders, 120 details/reviews, uneven helpful votes, 12 questions and 6 answers.
Accounts use reserved example.invalid emails/non-dialable phones; the BCrypt hash is for a discarded random secret.
No published usable credentials. ReviewDemo_v1 markers identify all records.
ReviewSampleDataCleanup.sql requires the same consent and fails closed on externally adopted references.
Do not remove markers. Running the seed again is a no-op if the complete demo exists.
Demo orders naturally appear in sales analytics: use only a disposable/local development DB.

## Verification commands
- dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false
- npm run lint --prefix frontend
- npm test --prefix frontend
- npm run build --prefix frontend
- PERSON3_API_URL=http://localhost:5121 node tests/reviews.integration.mjs
- Existing person3/wishlist/payment/catalog/product-removal integration suites (local fixtures only).
  Wishlist uses WISHLIST_API_URL; product-removal uses PRODUCT_API_URL.
- Optional tests/reviews.browser.mjs needs ReviewSampleData, Edge, Playwright (PLAYWRIGHT_MODULE override),
  API 5121 and frontend 2222. CORS already permits frontend 2222; no CORS changes required.
  Browser screenshots under docs/reviews; test accounts and their orders/reviews are cleaned after the run.

## Verified on 2026-10-29
- Backend build: PASS, 0 warnings/errors.
- Full frontend lint: PASS.
- Full frontend tests: PASS, 107 tests across 15 files (15 new engagement tests).
- Frontend production build: PASS; non-blocking Vite main-chunk warning (~591 KB before gzip).
- Reviews integration: PASS, including concurrent duplicate review/vote/image operations and private image access.
- Existing Person3, Wishlist, Payment, Catalog (including second-instance restart) and Product Removal: PASS.
- Browser desktop 1366 / mobile 390: PASS; create/edit, helpful, hide/restore, Q&A answer, admin analytics,
  Completed-order review CTA; no page errors or horizontal overflow.
- Reviews schema and demo seed reruns: PASS; no duplicate demo records.
- Demo cleanup exercised inside an outer rollback transaction: PASS; all 120 demo reviews restored.
- New module was based on origin/develop bfc6dae. Uncommitted dashboard/UI/seed work in the original checkout
  is intentionally outside this branch.
