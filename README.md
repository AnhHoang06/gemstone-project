# Gem Aurelia — Gemstone Shop

ASP.NET Core 8 + EF Core Database First + SQL Server; React 19 + Vite + Bootstrap; JWT and SignalR.
Use `develop` as the integration base, not the legacy `main` branch.

**Graders / quick start:** see [README_NopBai.md](README_NopBai.md) and [SETUP.md](SETUP.md) (restore `GemstoneShop_Final.bak`). Script order and demo data: [database/README_Database.md](database/README_Database.md). The section below is the developer setup for building a database from scripts.

## Local setup

Requirements: .NET 8 SDK, Node.js 20.19+ or 22.12+ (Vite 8), SQL Server with `sqlcmd` for integration tests.

1. Use the team's existing GemstoneShop database. For a **new empty development instance only**, inspect `database/GemstoneShop.sql` first; do not rerun the baseline creation script against an existing database.
2. Configure `ConnectionStrings:DefaultConnection` and a fresh random `Jwt:Key` (at least 32 UTF-8 bytes) using User Secrets or environment variables. See [Auth development setup](backend/GemstoneShop/GemstoneShop/AUTH-DEVELOPMENT.md). Do not commit credentials, signing keys or local configuration.
3. Run the following additive scripts **against the configured database**, in this order, before starting the new backend:

```powershell
$schema = 'backend/GemstoneShop/GemstoneShop/Database'
# Replace server/database with your local development instance as needed.
foreach ($script in @('Person3.sql', 'Wishlist.sql', 'Payment.sql', 'PaymentReported.sql', 'CategoryHierarchy.sql', 'ProductSearch.sql', 'Reviews.sql', 'Consultation.sql', 'Chat.sql', 'ContactMessages.sql')) {
    sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -i "$schema/$script"
    if ($LASTEXITCODE -ne 0) { throw "Schema setup failed: $script" }
}
```

These scripts are repeatable. `CategoryHierarchy.sql` retains existing categories as root nodes, adds parent/sort fields, and replaces global name uniqueness with sibling uniqueness. `ProductSearch.sql` adds the normalized search-name column and fills rows where it is still empty; the API also corrects missing or outdated search names at startup. `Reviews.sql` adds the review/Q&A tables ([details](backend/GemstoneShop/GemstoneShop/Database/Reviews.README.md)). `Consultation.sql` adds consultation services, weekly hours, closed dates and appointments; `Chat.sql` adds customer–staff conversations and messages ([details](backend/GemstoneShop/GemstoneShop/Database/ConsultationChat.README.md)). `PaymentReported.sql` adds `Orders.PaymentReportedAt` for the manual QR transfer flow ([details](backend/GemstoneShop/GemstoneShop/Database/Payment.README.md)); `ContactMessages.sql` adds the contact form inbox ([details](backend/GemstoneShop/GemstoneShop/Database/ContactMessages.README.md)). No database or historical order data is recreated. Stop the application during schema deployment and start the matching backend afterward.

Optional consultation data (development/demo machines only, never production) — run after the scripts above:

```powershell
sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -i "$schema/ConsultationSampleData.sql"
```

`ConsultationSampleData.sql` adds three consultation services — "Tư vấn thiết kế trang sức" (free, 60 min), "Kiểm tra & đánh giá đá quý" (500.000 ₫, 45 min), "Tư vấn bộ sưu tập & quà tặng" (free, 45 min) — and the weekly hours Mon–Sat 09:00–18:00, Sun 09:00–12:00, 60-minute slots, 2 customers per slot. It only inserts services (by name) and weekday rows that are missing, so hours already edited by an admin are kept; safe to rerun. Without it the booking page shows no services and every day as closed until an admin configures them.

The 14-product demo catalog (images in `wwwroot/catalog-gems/`, orders, reviews) is distributed only as the database backup `GemstoneShop_Final.bak` described in [SETUP.md](SETUP.md). `Catalog14Rebuild.sql` documents how it was produced but only runs against the original local database ([details](backend/GemstoneShop/GemstoneShop/Database/Catalog14.README.md)); it cannot seed an empty database.

4. Start backend (local HTTP example; Development loads User Secrets):

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --no-launch-profile --urls http://localhost:5113
```

5. In a second terminal:

```powershell
cd frontend
npm ci
$env:VITE_API_BASE_URL = 'http://localhost:5113'
npm run dev -- --host localhost --port 2222 --strictPort
```

Open **http://localhost:2222** (not 127.0.0.1; CORS allows localhost). `VITE_API_BASE_URL` is the backend origin (without `/api`; a trailing `/api` is still accepted). It is read in one place, `frontend/src/config/apiBase.js`, and used for API calls, SignalR hubs and backend-hosted images. In `npm run dev` it falls back to `http://localhost:5113`; a production build never falls back to localhost. For the Visual Studio HTTPS profile put `VITE_API_BASE_URL=https://localhost:1111` in `frontend/.env.local` (git-ignored) and trust the development certificate.

### Deploying the frontend to Vercel

Set the Vercel project's root directory to `frontend` and add the Environment Variable `VITE_API_BASE_URL` with the backend origin (for example `https://<your-backend-host>`), then redeploy; Vite reads it at build time. `frontend/vercel.json` rewrites every route to `index.html` so refreshing a React Router URL works. The backend must allow the Vercel origin in CORS (see below). Do not commit a `.env` with production values.

### Backend CORS (allowed frontend origins)

Browser origins allowed to call the API and the SignalR hubs (`/hubs/orders`, `/hubs/chat`) come from `Cors:AllowedOrigins` (a list). `appsettings.json` contains only `http://localhost:2222` for local development; if the list is empty the API also falls back to that origin. The policy allows any header (including `Authorization: Bearer`), any method and credentials, which SignalR negotiation needs, so every entry must be an exact origin: `scheme://host[:port]`, no path, no trailing slash, no `*`. An invalid entry stops the API at startup with a clear message.

On the host, override the list with standard environment variables (index 0, 1, … replace the entries from `appsettings.json`):

```
Cors__AllowedOrigins__0=https://<your-project>.vercel.app
Cors__AllowedOrigins__1=https://<your-custom-domain>        (optional)
```

On the hosting provider (currently Somee) they go next to the connection string in the published `web.config` (`<environmentVariable name="Cors__AllowedOrigins__0" value="https://<your-project>.vercel.app" />`); `deploy/somee/Prepare-SomeeUpload.ps1` writes them for you. See [deploy/somee/README.md](deploy/somee/README.md). Vercel preview URLs are different origins; add each one you need explicitly.

## Features and deployment notes

- [Cart, checkout receipts, order transactions and SignalR](PERSON3.md)
- [Wishlist schema and per-user API](WISHLIST.md)
- [Payment schema and bank configuration](backend/GemstoneShop/GemstoneShop/Database/Payment.README.md)
- [Existing bug-fix testing guide](TESTING-UX-ROUND1.md)
- [Catalog redesign: APIs, screenshots, verification and limitations](docs/catalog-redesign/README.md)
- [Product reviews and Q&A](backend/GemstoneShop/GemstoneShop/Database/Reviews.README.md)
- [Consultation booking and staff chat: schema, API, realtime, deployment](backend/GemstoneShop/GemstoneShop/Database/ConsultationChat.README.md)
- [Contact form and admin contact inbox](backend/GemstoneShop/GemstoneShop/Database/ContactMessages.README.md)
- [Support Center (`/ho-tro`)](docs/support-center.md)
- [Order shipping information edits](docs/order-shipping-edit.md)
- [Admin analytics dashboard](docs/admin-analytics/README.md) and [realtime refresh](docs/dashboard-realtime-review.md)
- [14-product demo catalog](backend/GemstoneShop/GemstoneShop/Database/Catalog14.README.md)

Contact/social information lives in `frontend/src/config/site.js`. Empty values are hidden; fill only verified store information. The home carousel currently shows newest products (there is no featured flag). Product images use existing uploads; missing images have a neutral placeholder. The support route intentionally contains no fake forms or business claims; the contact page (`/lien-he`) combines the authenticated staff chat with a contact form stored in `ContactMessages` (no e-mail delivery), and the appointment page uses the real booking API.

Database First extensions remain in partial files. Do not generate migrations or overwrite the extensions when scaffolding. `CategoryHierarchy.sql` owns uniqueness changes; scaffolded category index metadata has deliberately not been altered, and duplicate sibling names under different parents are verified at runtime.

## Verification

```powershell
dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false
cd frontend
npm run lint
npm test
npm run build
cd ..
node tests/person3.integration.mjs
node tests/wishlist.integration.mjs
node tests/product-removal.integration.mjs
node tests/payment.integration.mjs
node tests/catalog.integration.mjs
node tests/reviews.integration.mjs
node tests/consultation.integration.mjs
node tests/chat.integration.mjs
node tests/contact.integration.mjs
node tests/order-shipping.integration.mjs
node tests/analytics.integration.mjs
node tests/dashboard-realtime.integration.mjs
node tests/cors.integration.mjs
```

Integration suites require the local backend and matching local database. Defaults: API `http://localhost:5113`, SQL server `.\SQLEXPRESS`, DB `GemstoneShop`, Windows authentication. Override `PERSON3_API_URL`, `PERSON3_SQL_SERVER`, `PERSON3_SQL_DATABASE` together as needed. `tests/catalog.integration.mjs` reads `CATALOG_API_URL`, `CATALOG_SQL_SERVER`, `CATALOG_SQL_DATABASE` (falling back to the `PERSON3_*` values); its restart check starts a second API from the built `bin/Debug/<tfm>/GemstoneShop.dll` on `CATALOG_RESTART_URL` (default `http://localhost:5115`, override the DLL with `CATALOG_BACKEND_DLL`) and needs the same connection string and `Jwt:Key` in the environment — set `CATALOG_SKIP_RESTART=1` to skip it. `tests/consultation.integration.mjs` and `tests/chat.integration.mjs` read `CONSULT_*` / `CHAT_*` (`API_URL`, `SQL_SERVER`, `SQL_DATABASE`, falling back to `PERSON3_*`); the consultation suite temporarily replaces the weekly hours with a fixed test schedule and restores the original rows afterwards, so do not run it while someone is configuring hours. `tests/reviews.integration.mjs` uses `PERSON3_API_URL` (default `http://localhost:5121`). `tests/contact.integration.mjs` reads `CONTACT_API_URL`, `CONTACT_SQL_SERVER`, `CONTACT_SQL_DATABASE`. `tests/cors.integration.mjs` is read-only and reads `CORS_API_URL`, `CORS_ALLOWED` and `CORS_DENIED` (comma-separated origins; defaults `http://localhost:2222` / a non-allowed example origin). Use only a disposable/development database: tests create and clean temporary users/products/orders and exercise failure triggers and schema constraints. They are not production health checks.
