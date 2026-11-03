# Gem Aurelia — Setup guide (demo database)

This guide runs the shop locally from the submitted source code and the demo database backup. It takes about 15 minutes on a Windows machine. For building a database from SQL scripts instead, see the developer setup in [README.md](README.md).

## 1. Requirements

| Tool | Version | Check |
|---|---|---|
| .NET SDK | 8.0 or newer | `dotnet --version` |
| Node.js | 20.19+ or 22.12+ | `node -v` |
| SQL Server (Express is fine) | **SQL Server 2025 (17.x) or newer** — the backup was made on 17.0 and cannot be restored on 2022 or older | `sqlcmd -S .\SQLEXPRESS -E -C -Q "SELECT @@VERSION"` |
| sqlcmd | any recent version | `sqlcmd -?` |

The commands below assume the instance `.\SQLEXPRESS` with Windows authentication. Replace the server name if yours differs.

## 2. Restore the demo database

The package contains `GemstoneShop-demo.bak`. It already has every schema script applied plus the demo data: 5 categories, 14 products with photos, about 575 orders over the last 12 months, 173 verified-purchase reviews, consultation services and opening hours.

Copy the `.bak` into the SQL Server backup folder (the service account must be able to read it), for example `C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\Backup\`, then run in PowerShell:

```powershell
$bak  = 'C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\Backup\GemstoneShop-demo.bak'
$data = sqlcmd -S '.\SQLEXPRESS' -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))"
sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q "RESTORE DATABASE GemstoneShop FROM DISK = N'$bak' WITH MOVE N'GemstoneShop' TO N'$($data)GemstoneShop.mdf', MOVE N'GemstoneShop_log' TO N'$($data)GemstoneShop_log.ldf', RECOVERY"
```

If a `GemstoneShop` database already exists on that instance, restore under another name (for example `GemstoneShopDemo`, also changing the `.mdf`/`.ldf` file names) and use that name in the connection string below. Do not overwrite a database you still need.

Do **not** run the scripts in `backend/GemstoneShop/GemstoneShop/Database/` against the restored database; they are already applied.

## 3. Configure the backend

From the repository root:

```powershell
cd backend/GemstoneShop/GemstoneShop
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)))"
# Only if your server or database name differs from .\SQLEXPRESS / GemstoneShop:
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=.\SQLEXPRESS;Database=GemstoneShop;Trusted_Connection=True;TrustServerCertificate=True;"
cd ../../..
```

Optional — bank transfer QR. Without these four values the payment page shows "Thông tin chuyển khoản hiện chưa được cấu hình." and checkout with bank transfer still works, but no QR is shown. Cash on delivery is unaffected.

```powershell
cd backend/GemstoneShop/GemstoneShop
dotnet user-secrets set "Payment:BankTransfer:BankName" "<bank name>"
dotnet user-secrets set "Payment:BankTransfer:BankBin" "<6-digit NAPAS bank BIN>"
dotnet user-secrets set "Payment:BankTransfer:AccountNumber" "<account number>"
dotnet user-secrets set "Payment:BankTransfer:AccountHolder" "<ACCOUNT HOLDER>"
cd ../../..
```

## 4. Run

Terminal 1 — API on http://localhost:5113:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --no-launch-profile --urls http://localhost:5113
```

Terminal 2 — website on http://localhost:2222:

```powershell
cd frontend
npm ci
$env:VITE_API_BASE_URL = 'http://localhost:5113/api'
npm run dev -- --host localhost --port 2222 --strictPort
```

Open **http://localhost:2222** (use `localhost`, not `127.0.0.1`, because CORS only allows localhost). Swagger is at http://localhost:5113/swagger.

## 5. Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `<<ADMIN_EMAIL>>` | `<<ADMIN_PASSWORD>>` |
| Customer | `<<CUSTOMER_EMAIL>>` | `<<CUSTOMER_PASSWORD>>` |

You can also register a new customer from the website. The roughly 220 generated customers behind the demo orders are disabled and cannot sign in.

## 6. What to try

Customer (storefront):
- `/products` — catalog with category tree, Vietnamese search (with or without accents), filters; product detail with specs, reviews, Q&A, related and recently viewed products.
- Wishlist, cart, checkout with **COD** or **bank transfer**; `/payment/{id}` shows the QR, copy buttons and "Tôi đã chuyển khoản".
- `/orders` — order history, status updates in real time, cancel and shipping-info edit while the order is still Pending.
- Review a product after a Completed order.
- `/hen-lich` — book a consultation; `/appointments` — my appointments.
- `/lien-he` — live chat with staff and the contact form; `/ho-tro` — support center.

Admin (`/admin/...`):
- `dashboard` — revenue, orders, top products/categories, review analytics; refreshes when orders change.
- `products`, `categories` — manage catalog and images; `orders` — confirm bank transfers, move orders through Confirmed → Shipping → Completed.
- `customers`, `reviews`, `consultation` (services and hours), `appointments`, `chat`, `contacts`.

Revenue on the dashboard counts only orders that are both **Completed and Paid**.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `RESTORE` fails with "version … is incompatible" | Your SQL Server is older than 2025 (17.x). Install SQL Server 2025 Express or newer. |
| `RESTORE` fails with "Access is denied" | Put the `.bak` in the instance's `Backup` folder shown in step 2. |
| API fails at startup mentioning `Jwt:Key` | Run the `user-secrets set "Jwt:Key"` command in step 3 and make sure `ASPNETCORE_ENVIRONMENT=Development`. |
| Website loads but shows no products / network errors | Check the API terminal is running on 5113 and that `VITE_API_BASE_URL` was set **before** `npm run dev`. |
| Login works but admin menu is missing | Sign in with the Admin account from step 5. |
| No QR on the payment page | Expected until the four `Payment:BankTransfer:*` values are configured (step 3). |

## 8. Automated checks (optional)

```powershell
dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo
cd frontend; npm run lint; npm test; npm run build; cd ..
```

The `tests/*.integration.mjs` suites create and delete their own test data in the database. Run them only against a copy, never against the restored demo database you are grading. See [README.md](README.md#verification).
