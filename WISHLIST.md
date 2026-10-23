# Wishlist / Favorites

## Database First deployment

Before starting the new backend, run `backend/GemstoneShop/GemstoneShop/Database/Wishlist.sql` against the SAME database configured for the API. It creates only `dbo.WishlistItems` when absent; it does not recreate/drop the database or modify existing rows. Sequential reruns are safe. An already-existing table is assumed to have the documented shape; the script does not silently repair a different schema.

- `UserId int`, `ProductId int`, `CreatedAt datetime2` (UTC default).
- Composite primary key `(UserId, ProductId)` enforces uniqueness.
- Foreign keys to Users and Products have NO cascading delete.
- `Models/WishlistItem.cs` and `Data/WishlistContext.cs` supply the mapping, called by the existing `OnModelCreatingPartial` implementation in `Data/CommerceContext.cs`. Preserve these extensions when scaffolding; do not generate a duplicate mapping/entity.

Local example (Windows integrated SQL authentication):

```powershell
sqlcmd -S .\SQLEXPRESS -d GemstoneShop -E -C -b -i backend/GemstoneShop/GemstoneShop/Database/Wishlist.sql
```

## API and behavior

All endpoints require the existing JWT authentication (including active-account validation). UserId always comes from the validated claim, never from a body/query parameter. Admins also have their own private wishlist; there is no endpoint for reading another user's list.

- `GET /api/wishlist`: active products saved by this user, newest first; card DTO only, no User or PasswordHash.
- `POST /api/wishlist/{productId}`: add an existing active product; missing product returns 404, inactive returns 409. Repeated additions succeed without duplicates or changing CreatedAt.
- `DELETE /api/wishlist/{productId}`: remove only the caller's entry; absent/inactive entries can be removed idempotently.
- Success returns HTTP 200 and the current active-product list from all three endpoints. Mutations return an authoritative snapshot to synchronize every heart immediately.
- SQL transaction-owned `sp_getapplock` on `wishlist:{userId}` serializes reads/adds/removals across instances sharing the database; the composite key also prevents duplicate rows at the database level.
- Soft-deactivated products keep their historical wishlist entries but are omitted from results. Reactivation makes the saved entries visible again. No Product, Cart, Order, image or certificate data is changed by wishlist operations.

## Frontend

One session-keyed provider uses the existing Axios client. Cards, both product-detail routes and Wishlist share heart state. A filled heart means the API confirms the favorite; failures never optimistically remove/add a product. Requests are serialized while submitting, stale GETs cannot replace mutation results, and old-session responses are ignored. Logout/account changes remount and clear the state. An unauthenticated/expired-session click uses the existing logout/login redirect flow.

Lists reload on entry to `/wishlist`, window focus and explicit refresh. There is no wishlist SignalR subscription or cross-tab instant sync; another tab's changes appear on focus/refresh. After an ambiguous mutation failure, refresh before retrying so the UI does not guess POST versus DELETE. Lists are unpaginated for the university-project scope.

## Verification

- Backend: `dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false`.
- Frontend: `npm test`, `npm run lint`, `npm run build` from `frontend`.
- Integration: start the backend on `http://localhost:5113` using its existing Development configuration, then `node tests/wishlist.integration.mjs`. Optional `WISHLIST_API_URL`, `WISHLIST_SQL_SERVER`, `WISHLIST_SQL_DATABASE` must refer to the same local development/test database. The test restricts API hosts to loopback, uses uniquely named fixtures and removes them in `finally`.
- React coverage includes synchronized hearts/list, double-click protection, failed load/mutation, stale GET/mutation responses, logout/account switching, and unauthenticated redirects. SQL/API tests cover JWT ownership, duplicates/concurrent add/remove, missing/inactive products, reactivation, active-account revocation, schema rerun and FK/unique constraints.
