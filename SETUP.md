# Gem Aurelia — Setup guide

This guide runs the shop locally from the source code and the demo database backup `GemstoneShop_Final.bak`. It takes about 15 minutes on Windows. Database details (script order, demo data, backup contents) are in [database/README_Database.md](database/README_Database.md).

Paths below are relative to the project root (the folder that contains `backend/`, `frontend/` and `database/`).

## A. Requirements

| Tool | Version | Check |
|---|---|---|
| .NET SDK | 8.0 or newer (the project targets `net8.0`) | `dotnet --version` |
| Node.js + npm | Node 20.19+ or 22.12+ (required by Vite 8), npm 10+ | `node -v`, `npm -v` |
| SQL Server | **SQL Server 2025 (17.x) or newer**, Express is fine. The backup was made on 17.0 and cannot be restored on 2022 or older. | `sqlcmd -S .\SQLEXPRESS -E -C -Q "SELECT @@VERSION"` |
| sqlcmd | any recent version (installed with SQL Server tools) | `sqlcmd -?` |
| SSMS | optional, for restoring/browsing the database with a GUI | |

The commands assume the SQL Server instance `.\SQLEXPRESS` with Windows authentication. Replace the server name if yours differs.

## B. Database — restore `GemstoneShop_Final.bak` (primary method)

The backup already contains every required schema script and the demo data. Do **not** run the SQL scripts against the restored database.

**With sqlcmd (PowerShell):** copy `database/GemstoneShop_Final.bak` into the SQL Server backup folder (the SQL Server service must be able to read it), then:

```powershell
$bak  = 'C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\Backup\GemstoneShop_Final.bak'
$data = sqlcmd -S '.\SQLEXPRESS' -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))"
sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q "RESTORE DATABASE GemstoneShop FROM DISK = N'$bak' WITH MOVE N'GemstoneShop' TO N'$($data)GemstoneShop.mdf', MOVE N'GemstoneShop_log' TO N'$($data)GemstoneShop_log.ldf', RECOVERY"
```

**With SSMS:** right-click *Databases* → *Restore Database…* → *Device* → select `GemstoneShop_Final.bak` → database name `GemstoneShop` → OK.

If a `GemstoneShop` database already exists and you still need it, restore under another name (for example `GemstoneShopDemo`, with different `.mdf`/`.ldf` file names) and use that name in the connection string in step C.

## C. Backend (ASP.NET Core 8 Web API)

1. **Connection string.** `appsettings.json` already points to `Server=.\SQLEXPRESS;Database=GemstoneShop;Trusted_Connection=True;TrustServerCertificate=True;`. Only if your server or database name differs, override it:

   ```powershell
   cd backend/GemstoneShop/GemstoneShop
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=<server>;Database=<database>;Trusted_Connection=True;TrustServerCertificate=True;"
   cd ../../..
   ```

2. **JWT signing secret (required).** The API refuses to start without one. Generate a fresh random key once:

   ```powershell
   cd backend/GemstoneShop/GemstoneShop
   dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)))"
   cd ../../..
   ```

3. **Bank transfer QR (optional).** Without these values, checkout with bank transfer still works but the payment page shows "Thông tin chuyển khoản hiện chưa được cấu hình." instead of a QR. Cash on delivery is unaffected. No bank details are included in this project.

   ```powershell
   cd backend/GemstoneShop/GemstoneShop
   dotnet user-secrets set "Payment:BankTransfer:BankName" "<BANK_NAME>"
   dotnet user-secrets set "Payment:BankTransfer:BankBin" "<SIX_DIGIT_NAPAS_BANK_BIN>"
   dotnet user-secrets set "Payment:BankTransfer:AccountNumber" "<ACCOUNT_NUMBER>"
   dotnet user-secrets set "Payment:BankTransfer:AccountHolder" "<ACCOUNT_HOLDER>"
   cd ../../..
   ```

   If you enter made-up values to see the QR screen, that account is **demo-only: never transfer real money to it**.

4. **Restore and run** (terminal 1):

   ```powershell
   dotnet restore backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj
   $env:ASPNETCORE_ENVIRONMENT = 'Development'
   dotnet run --project backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --no-launch-profile --urls http://localhost:5113
   ```

   `Development` is needed so that User Secrets are loaded.

## D. Frontend (React + Vite)

Terminal 2:

```powershell
cd frontend
npm ci
$env:VITE_API_BASE_URL = 'http://localhost:5113'
npm run dev
```

`npm ci` installs the exact versions from `package-lock.json` (`npm install` also works). Instead of setting the variable in every terminal you can create `frontend/.env.local` containing `VITE_API_BASE_URL=http://localhost:5113`. The value is the backend address without `/api`; if it is not set, `npm run dev` uses `http://localhost:5113`.

## E. Local URLs

| What | URL |
|---|---|
| Website | **http://localhost:2222** (use `localhost`, not `127.0.0.1`: CORS only allows `http://localhost:2222`) |
| API | http://localhost:5113/api |
| Swagger (Development only) | http://localhost:5113/swagger |
| Product images | served by the API, e.g. http://localhost:5113/catalog-gems/ruby-oval.jpg |

The Visual Studio `https` launch profile (https://localhost:1111) also works; then set `VITE_API_BASE_URL=https://localhost:1111` (for example in `frontend/.env.local`) and trust the development HTTPS certificate (`dotnet dev-certs https --trust`).

## F. Demo accounts

**DEMO ACCOUNTS FOR GRADING/PRESENTATION ONLY.** Both accounts are in `GemstoneShop_Final.bak`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gemaurelia.test` | `<<ADMIN_PASSWORD>>` |
| Customer | `customer@gemaurelia.test` | `<<CUSTOMER_PASSWORD>>` |

The passwords are given in the submission package only, not in the public repository. You can also register a new customer on the website. The generated customers behind the demo orders are disabled and cannot sign in.

## G. Main completed modules

Customer:
- Register, login, profile, change password.
- Catalog with a 3-level category tree, Vietnamese search with or without accents, filters; product detail with specs, reviews, Q&A, related and recently viewed products.
- Wishlist, cart, checkout (duplicate-submit protection, stock reserved in a transaction).
- Payment by **cash on delivery** or **manual bank transfer with a locally generated VietQR code**: the customer presses "Tôi đã chuyển khoản", an admin confirms receipt.
- `/orders`: order history with real-time status updates (SignalR); cancel an order, or edit its shipping information while it is Pending or Confirmed.
- Verified-purchase reviews after a Completed order, helpful votes.
- `/hen-lich`: book a consultation; `/appointments`: my appointments.
- `/lien-he`: live chat with staff plus a contact form; `/ho-tro`: support center.

Admin (`/admin/...`):
- `dashboard`: revenue, orders, top products/categories and review analytics, refreshed when orders change. Revenue counts only orders that are both **Completed and Paid**.
- `products`, `categories`: catalog and image management, hide/show products.
- `orders`: confirm bank transfers, move orders Confirmed → Shipping → Completed, edit shipping information.
- `customers`, `reviews`, `consultation` (services and opening hours), `appointments`, `chat`, `contacts`.

## H. Troubleshooting

| Symptom | Fix |
|---|---|
| `RESTORE` fails with "version … is incompatible" | Your SQL Server is older than 2025 (17.x). Install SQL Server 2025 Express or newer. |
| `RESTORE` fails with "Access is denied" / "Cannot open backup device" | Put the `.bak` in the instance's `Backup` folder (step B). |
| API stops at startup mentioning `Jwt:Key` | Run step C.2 and make sure `ASPNETCORE_ENVIRONMENT=Development`. |
| Website shows no products / network errors | Check the API terminal runs on 5113 and `VITE_API_BASE_URL` was set **before** `npm run dev`. |
| Admin menu missing after login | Sign in with the Admin demo account. |
| No QR on the payment page | Expected until the four `Payment:BankTransfer:*` values are set (step C.3). |
| `npm run build` prints "Some chunks are larger than 500 kB" | Known warning about bundle size; the build still succeeds. |

## I. Automated checks (optional)

```powershell
dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false
cd frontend; npm run lint; npm test; npm run build; cd ..
```

The `tests/*.integration.mjs` suites (see [README.md](README.md#verification)) create and delete data in the database. Run them only against a separate copy, **never against the restored demo database**.
