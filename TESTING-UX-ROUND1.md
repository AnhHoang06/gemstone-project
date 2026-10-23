# Round 1 bug/UX fixes — teammate testing

Branch: `fix/ux-bugfix-round1`, based on develop `233def8`. This is a testing branch, not a merge into develop/main.

## Included

- Cart +/- immediately saves through the existing API; manual input saves on blur/Enter, failed updates restore server values, duplicate submissions are blocked. Server totals remain authoritative (1,000,000 x 2 = 2,000,000).
- Valid local Customer/Admin sessions redirect away from login/register using the existing expiry check; backend authentication remains authoritative.
- Customers can confirm cancellation of Pending orders from history through the existing cancellation API. Both order lists support row click and Enter/Space, without triggering navigation from action controls.
- Category row selection populates the edit form; keyboard support, selected/hover styles and independent delete action are preserved.
- Product removal uses existing soft delete, hides inactive products from the normal admin/public lists and rejects normal editing of inactive products. Images, certificates, cart references and order history remain intact.
- Real per-user Wishlist, shared heart controls, session isolation, additive database mapping/script and tests. See `WISHLIST.md`.
- Vietnamese font support and the small styles required by these controls/dialogs.

Excluded: broad UI consistency audit (awaiting desktop/mobile visual verification). No unfinished Payment or Dashboard expansion was found in the reviewed changes. No secrets, generated outputs or unrelated teammate code are included.

## Get the branch

Run from a clean checkout; preserve any work of your own before switching.

```powershell
git fetch origin
git switch --track origin/fix/ux-bugfix-round1
```

If the local branch already exists, use `git switch fix/ux-bugfix-round1` then `git pull --ff-only`.

## Database and local configuration

Prerequisites: .NET SDK matching the project, Node/npm, SQL Server with the existing GemstoneShop schema, and `sqlcmd`. Use your own local development database, not a shared production database.

Configure `ConnectionStrings:DefaultConnection` and your own `Jwt:Key` using User Secrets or environment variables, following `backend/GemstoneShop/GemstoneShop/AUTH-DEVELOPMENT.md`. No signing key is supplied in Git. Keep API and integration-test database settings identical.

From repository root, apply the additive scripts to that database (change server/database below if yours differ):

```powershell
sqlcmd -S .\SQLEXPRESS -d GemstoneShop -E -C -b -i backend/GemstoneShop/GemstoneShop/Database/Person3.sql
sqlcmd -S .\SQLEXPRESS -d GemstoneShop -E -C -b -i backend/GemstoneShop/GemstoneShop/Database/Wishlist.sql
```

These scripts do not recreate/drop the database. Wishlist must be applied before starting this branch's API. Preserve the custom context extensions when scaffolding.

## Start and verify

Backend terminal, repository root (configure a local JWT key first):

```powershell
dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --no-launch-profile --urls http://localhost:5113
```

Frontend terminal, repository root:

```powershell
cd frontend
npm ci
npm run lint
npm test
npm run build
$env:VITE_API_BASE_URL = 'http://localhost:5113/api'
npm run dev -- --port 2222
```

Open `http://localhost:2222`. Use an existing local Admin account for admin checks; register disposable Customer accounts for user isolation. No shared account password is published.

Integration terminal, repository root, with the backend running:

```powershell
node tests/person3.integration.mjs
node tests/wishlist.integration.mjs
node tests/product-removal.integration.mjs
```

Defaults are API `http://localhost:5113`, SQL server `.\SQLEXPRESS`, database `GemstoneShop`, Windows integrated authentication. For custom settings set all three corresponding prefixes (`PERSON3_`, `WISHLIST_`, `PRODUCT_`) with suffixes `API_URL`, `SQL_SERVER`, `SQL_DATABASE`. Do not point tests at a different database from the API. Tests create uniquely named fixtures and remove them in `finally`; Person 3 also temporarily installs a trigger scoped to its fixture user to verify rollback. Run only against your local development/test database.

## Manual acceptance

1. Cart: +/- updates quantity and server totals without a save button; input blur/Enter saves; an API failure does not pretend success.
2. Logged-in Customer visiting login/register goes home; Admin goes to dashboard. Logged-out forms still work.
3. Customer/Admin order rows navigate by click/keyboard. Pending customer cancel opens an in-app dialog; other statuses have no customer cancel action.
4. Category rows load the edit form; Cancel resets it; delete does not select the row.
5. Product deletion removes it from normal lists, leaves IsActive=false in SQL and preserves order history; direct normal edit is rejected.
6. Favorite a real product, reload, check detail/card/list hearts, then remove. A second user must not see the first user's favorites. Inactive products stay hidden.

## Verification before commit

- Backend build: PASS, 0 warnings/errors.
- Frontend build and full lint: PASS.
- React: 39 tests across 7 files PASS.
- Person 3, Wishlist and product-removal local SQL/API integration suites: PASS, fixtures cleaned up.
- Existing Vite bundle-size warning (>500 KB) remains. Automated React tests do not replace desktop/mobile visual review; the broad audit styles are excluded.
