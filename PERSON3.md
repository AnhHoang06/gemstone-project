# Person 3 — Cart / Checkout / Orders / SignalR

## Setup

This work is on `feature/order`, based on develop `161e0fe`. Pre-existing uncommitted reversible-product-status work is preserved. Nothing is pushed or merged.

1. Configure the existing database connection and a fresh JWT key as documented in `backend/GemstoneShop/GemstoneShop/AUTH-DEVELOPMENT.md`. Do not reuse any key from Git history.
2. Run `backend/GemstoneShop/GemstoneShop/Database/Person3.sql` against that database. This additive, repeatable Database First script creates **CheckoutReceipts** and adds missing status names only. Existing tables/data/mappings are not recreated. The additional EF mapping is isolated in `Data/CommerceContext.cs`; preserve it when scaffolding.
3. Backend: `dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --launch-profile https`.
4. Frontend: `cd frontend`, `npm install`, `npm run dev -- --port 2222`. Default API is `https://localhost:1111/api`; override using `VITE_API_BASE_URL` when necessary. Trust the local ASP.NET development certificate. The hub uses the same API origin, `/hubs/orders`. CORS permits the existing frontend origin `http://localhost:2222`, with credentials for SignalR negotiation.

## APIs and guarantees

- Authenticated cart: `GET/DELETE /api/cart`, `POST/PUT/DELETE /api/cart/items/{productId}`. POST adds quantity; PUT sets absolute quantity. User ID always comes from the validated JWT; no client cart/user ID is accepted. Prices/totals are server-derived. Cart contents do not reserve stock.
- `POST /api/orders`: body `{ requestId: UUID, recipientName, recipientPhone, shippingAddress, note }`. Send the **same requestId and body** after a timeout, disconnect, 500 or `request_busy` response. Server keeps a durable `(UserId, RequestId)` receipt with a request hash and OrderId. A repeated request returns the original OrderId; a different body with that ID is rejected.
- `GET /api/orders`, `GET /api/orders/{id}`, `PUT /api/orders/{id}/cancel`: only the current user's orders; customers can cancel Pending only.
- Admin: `GET /api/orders/admin?status=Pending`, `GET /api/orders/admin/{id}`, `PUT /api/orders/admin/{id}/status` with `{status}`. Pending → Confirmed → Shipping → Completed; Admin can cancel Pending/Confirmed. `GET /api/orders/statuses` reads status names from the database.
- Cart mutations and checkout use SQL Server transaction-owned `sp_getapplock` per user, including initial cart creation. Checkout sorts product updates, conditionally decrements stock, snapshots product names/prices, creates order/details/receipt and empties the cart in one transaction. Failures roll everything back.
- Transitions use a per-order SQL lock **and** compare-and-set status update. Stock restitution occurs only on a successful first transition to Cancelled. Retrying an already-applied target is idempotent.
- SignalR `[Authorize]` hub assigns only server-controlled user/Admin groups. `NewOrder` goes to Admin, `OrderStatusChanged` to owner and Admin, after commit. Events carry OrderId only; HTTP revalidates account/ownership before reading data. Realtime delivery failure is logged and cannot fail a committed checkout.
- Frontend retries initial hub connection failure, handles reconnect, and refreshes cart/orders after reconnect. Logout/account switching stops the old connection and remounts user-scoped state. Axios discards old-session responses, including old 401s. The hub closes when authentication expires; the frontend also rechecks `/users/me` each minute to handle locked accounts during an idle connection.

## Try Customer/Admin

- Customer: register/login with the existing pages; open `/shop` or `/products`, add a real product, edit quantities at `/cart`, then submit `/checkout`. Recipient data is prefilled from `/api/users/me`. View `/orders` and `/orders/{id}`; cancel a Pending order.
- Admin: login using an existing Admin account, open `/admin/orders`, filter/open the order and advance its status. In a second Customer tab/session, observe the status refresh. Disconnect/reconnect the network and confirm the connection indicator and refreshed list.
- Existing Account, Customer, Product/Category and Dashboard routes remain. No payment provider or payment state is invented. Revenue remains outside this work.
- Wishlist is still a separate legacy mock feature. Its sample cards intentionally cannot add mock IDs to the real cart. Storefront `/shop`, `/product/:id`, `/products` and `/products/:id` use the Product API.

## Repeatable verification

Backend build (isolated output avoids locking an existing running development server):

```powershell
dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false -o backend/GemstoneShop/GemstoneShop/bin/order-check
```

Frontend: `npm test`, `npm run lint`, `npm run build` from `frontend`.

Real database integration test (development/test DB only): start the above backend build with Development environment on `http://localhost:5113` from its project directory, then run `node tests/person3.integration.mjs` from repo root. It uses Windows integrated SQL authentication, requires `sqlcmd`, and creates/cleans up its own users/products/orders. Optional environment overrides: `PERSON3_API_URL` (loopback only), `PERSON3_SQL_SERVER`, `PERSON3_SQL_DATABASE`; these **must target the same database as the API**. It briefly creates a rollback-test trigger restricted to its generated fixture user, then drops it in `finally`.

Inactive-product fixtures use direct SQL updates scoped to generated product IDs/names; tests do not call Product DELETE/status endpoints or depend on the separate soft-delete changes. Fixture cleanup also runs on failure.

Coverage: ownership, customer/admin authorization, concurrent cart additions, last-unit race, replayed checkout, double cancellation, cancel-vs-confirm, cart-vs-checkout, legal transitions, rollback after a later stock failure and after Order insertion, SignalR recipient isolation, and inactive account rejection. Established WebSocket tests verify that deactivated owners/Admins stop receiving events while still connected, and receive events again after reactivation. React tests cover a pending initial cart GET followed by a successful mutation and late stale GET (cart stays current and loading finishes), old-session responses/401s, clearing user data/stopping old hubs, initial retry, reconnect resync, and preserving checkout request IDs after ambiguous responses.

## Limits

- Realtime is best effort; API refresh/reconnect is the source of truth, not guaranteed event delivery. Each publication queries active recipients from the database and targets per-user groups (separate Admin groups require an Admin JWT at connection time). Inactive/deleted accounts are excluded even on established connections. Connections are not forcibly closed; events already selected/in flight when deactivation occurs cannot be recalled. No backplane is configured, so realtime delivery is limited to connections on the publishing instance; database locking/idempotency remains shared across instances.
- Lists are unpaginated for this university-project scope. No payment integration, refresh-token infrastructure, or production notification outbox is added.
- Checkout drafts are cleared on logout/account changes for privacy. If logout follows an ambiguous checkout, inspect order history before ordering again.
- Dependency audit currently reports four high-severity findings in the existing Vite/transitive dependency tree (`vite`, `brace-expansion`, `source-map-js`, `follow-redirects`). These require a separately reviewed dependency update; no unrelated forced upgrade was applied.
