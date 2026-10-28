# Gem Aurelia — Gemstone Shop

ASP.NET Core 8 + EF Core Database First + SQL Server; React 19 + Vite + Bootstrap; JWT and SignalR.
Use `develop` as the integration base, not the legacy `main` branch. Catalog redesign is on `feature/ui-catalog-redesign` pending review.

## Local setup

Requirements: .NET 8 SDK, Node.js (compatible with Vite 8), SQL Server with `sqlcmd` for integration tests.

1. Use the team's existing GemstoneShop database. For a **new empty development instance only**, inspect `database/GemstoneShop.sql` first; do not rerun the baseline creation script against an existing database.
2. Configure `ConnectionStrings:DefaultConnection` and a fresh random `Jwt:Key` (at least 32 UTF-8 bytes) using User Secrets or environment variables. See [Auth development setup](backend/GemstoneShop/GemstoneShop/AUTH-DEVELOPMENT.md). Do not commit credentials, signing keys or local configuration.
3. Run the following additive scripts **against the configured database**, in this order, before starting the new backend:

```powershell
$schema = 'backend/GemstoneShop/GemstoneShop/Database'
# Replace server/database with your local development instance as needed.
foreach ($script in @('Person3.sql', 'Wishlist.sql', 'Payment.sql', 'CategoryHierarchy.sql', 'ProductSearch.sql')) {
    sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -i "$schema/$script"
    if ($LASTEXITCODE -ne 0) { throw "Schema setup failed: $script" }
}
```

These scripts are repeatable. `CategoryHierarchy.sql` retains existing categories as root nodes, adds parent/sort fields, and replaces global name uniqueness with sibling uniqueness. `ProductSearch.sql` adds/backfills normalized search names. No database or historical order data is recreated. Stop the application during schema deployment and start the matching backend afterward.

4. Start backend (local HTTP example; Development loads User Secrets):

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --no-launch-profile --urls http://localhost:5113
```

5. In a second terminal:

```powershell
cd frontend
npm ci
$env:VITE_API_BASE_URL = 'http://localhost:5113/api'
npm run dev -- --host localhost --port 2222 --strictPort
```

Open **http://localhost:2222** (not 127.0.0.1; CORS allows localhost). The default frontend API URL remains `https://localhost:1111/api` if no override is supplied; the existing HTTPS launch profile can also be used with a trusted development certificate.

## Features and deployment notes

- [Cart, checkout receipts, order transactions and SignalR](PERSON3.md)
- [Wishlist schema and per-user API](WISHLIST.md)
- [Payment schema and bank configuration](backend/GemstoneShop/GemstoneShop/Database/Payment.README.md)
- [Existing bug-fix testing guide](TESTING-UX-ROUND1.md)
- [Catalog redesign: APIs, screenshots, verification and limitations](docs/catalog-redesign/README.md)

Contact/social information lives in `frontend/src/config/site.js`. Empty values are hidden; fill only verified store information. The home carousel currently shows newest products (there is no featured flag). Product images use existing uploads; missing images have a neutral placeholder. Knowledge, contact, appointment and support routes intentionally contain no fake forms or business claims.

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
```

Integration suites require the local backend and matching local database. Defaults: API `http://localhost:5113`, SQL server `.\SQLEXPRESS`, DB `GemstoneShop`, Windows authentication. Override `PERSON3_API_URL`, `PERSON3_SQL_SERVER`, `PERSON3_SQL_DATABASE` together as needed. Use only a disposable/development database: tests create and clean temporary users/products/orders and exercise failure triggers and schema constraints. They are not production health checks.
