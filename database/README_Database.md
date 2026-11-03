# Gem Aurelia — Database

SQL Server, **Database First**: the database schema is the source of truth and EF Core maps it. There are no EF migrations.

Where the files are:

| | In the GitHub repository | In the submission package |
|---|---|---|
| Baseline (empty DB) | `database/GemstoneShop.sql` | `database/scripts/GemstoneShop.sql` |
| Schema extension and data scripts | `backend/GemstoneShop/GemstoneShop/Database/*.sql` | `database/scripts/*.sql` (copy) and the original folder |
| Demo backup | not committed | `database/GemstoneShop_Final.bak` |

## 1. Primary method: restore `GemstoneShop_Final.bak`

Restore the backup as described in [SETUP.md](../SETUP.md#b-database--restore-gemstoneshop_finalbak-primary-method). It needs **SQL Server 2025 (17.x) or newer**. Logical file names: `GemstoneShop` (data) and `GemstoneShop_log` (log).

The backup already contains every required schema script below plus the demo data. **Do not run any script against the restored database**, and do not run the `tests/*.integration.mjs` suites against it (they insert and delete test data).

Contents of the demo backup:

- Roles Admin/Customer; two demo accounts `admin@gemaurelia.test` (Admin) and `customer@gemaurelia.test` (Customer). Passwords are in the submission package's `SETUP.md` / `README_NopBai.md`, not in the repository.
- 5 public categories (Ruby, Sapphire, Emerald, Diamond, Amethyst) and 14 public products, each with a photo in `backend/GemstoneShop/GemstoneShop/wwwroot/catalog-gems/`. Older products are kept inactive (hidden) because historical orders reference them.
- About 575 orders over the previous 12 months with order details and payment fields (COD and bank transfer), so the admin dashboard has data. The generated customers behind these orders are disabled.
- 173 verified-purchase reviews with helpful votes, product questions and answers.
- 3 consultation services and weekly opening hours (from `ConsultationSampleData.sql`).
- Empty but present tables for chat, appointments and contact messages.

## 2. Alternative: build an empty database from scripts

Use this only for a new, empty development database. It produces the full schema **without** the demo catalog, orders or reviews.

### 2.1 REQUIRED SCHEMA — run in this order

0. `GemstoneShop.sql` — baseline: creates the `GemstoneShop` database, core tables, the Admin/Customer roles, order statuses and 5 root categories. Run once, only on a server that has no `GemstoneShop` database.

Then, against the `GemstoneShop` database:

1. `Person3.sql` — cart, checkout receipts, order transactions
2. `Wishlist.sql` — wishlist
3. `Payment.sql` — payment method/status/paid-at fields on orders
4. `PaymentReported.sql` — `Orders.PaymentReportedAt` for the manual QR transfer flow
5. `CategoryHierarchy.sql` — category parent/sort fields, sibling-unique names
6. `ProductSearch.sql` — normalized Vietnamese search column
7. `Reviews.sql` — reviews, helpful votes, review images, questions and answers
8. `Consultation.sql` — consultation services, weekly hours, closed dates, appointments
9. `Chat.sql` — customer–staff conversations and messages
10. `ContactMessages.sql` — contact form inbox

All ten are additive and safe to rerun. Example (PowerShell, from the project root; in the submission package use `database/scripts` as `$dir`):

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -C -b -f 65001 -i database/GemstoneShop.sql
$dir = 'backend/GemstoneShop/GemstoneShop/Database'
foreach ($s in 'Person3','Wishlist','Payment','PaymentReported','CategoryHierarchy','ProductSearch','Reviews','Consultation','Chat','ContactMessages') {
    sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -f 65001 -i "$dir/$s.sql"
    if ($LASTEXITCODE -ne 0) { throw "Schema setup failed: $s.sql" }
}
```

The first user registered through the website is a Customer. To make an admin on a script-built database, promote that account manually:

```sql
UPDATE u SET RoleId = r.Id FROM Users u JOIN Roles r ON r.Name = N'Admin' WHERE u.Email = N'<your email>';
```

### 2.2 OPTIONAL DEMO / SAMPLE DATA

- `ConsultationSampleData.sql` — optional demo configuration: 3 consultation services and Mon–Sun opening hours. Without it `/hen-lich` shows every day as closed until an admin configures services and hours. Inserts only missing rows; safe to rerun. (Already applied in `GemstoneShop_Final.bak`.)
- `Catalog14Rebuild.sql` / `Catalog14Cleanup.sql` — **not a portable seed.** These documented how the 14-product demo catalog was produced on the original development database. They check for that database's specific order and product IDs and refuse to run anywhere else, so they cannot fill an empty database. The demo catalog is distributed only through `GemstoneShop_Final.bak`. See `Catalog14.README.md`.

No other seed scripts are part of the project.

## 3. Module documentation

- Payment and QR configuration: `backend/GemstoneShop/GemstoneShop/Database/Payment.README.md`
- Reviews and Q&A: `.../Database/Reviews.README.md`
- Consultation and chat: `.../Database/ConsultationChat.README.md`
- Contact messages: `.../Database/ContactMessages.README.md`
- Demo catalog: `.../Database/Catalog14.README.md`
