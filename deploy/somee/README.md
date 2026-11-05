# Deploying the backend to Somee

The ASP.NET Core 8 backend is published to a local folder and uploaded to the Somee website root. No host, password or key is stored in Git: the publish profile has none, and the runtime settings are written only into the local, git-ignored publish output.

| | |
|---|---|
| Publish profile | `backend/GemstoneShop/GemstoneShop/Properties/PublishProfiles/Somee-Folder.pubxml` (Folder / FileSystem, Release, net8.0, framework-dependent) |
| Output folder | `artifacts/publish/somee/` (git-ignored) |
| SQL Server | `gemaurelia.mssql.somee.com`, database `gemaurelia`, login `cakkonka_SQLLogin_1` |
| Frontend origin (CORS) | `https://gemstone-project.vercel.app` |

## 1. Build the upload folder

From the repository root, in Windows PowerShell:

```powershell
.\deploy\somee\Prepare-SomeeUpload.ps1
```

The script:
1. runs `dotnet publish` with the Somee profile into an emptied `artifacts/publish/somee/`;
2. checks that the output has `web.config`, `GemstoneShop.dll`, `.deps.json`, `.runtimeconfig.json`, the main dependency DLLs, `wwwroot/` and all 14 images in `wwwroot/catalog-gems/`, and contains no old SmarterASP host;
3. asks for the SQL password (hidden input) and writes these settings into the output's `web.config` under `<aspNetCore><environmentVariables>`:

| Variable | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | `Server=gemaurelia.mssql.somee.com;Database=gemaurelia;User Id=cakkonka_SQLLogin_1;Password=<SOMEE_SQL_PASSWORD>;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=False` |
| `Jwt__Key` | a newly generated random key (at least 32 bytes) |
| `Cors__AllowedOrigins__0` | `https://gemstone-project.vercel.app` |

Options: `-Placeholders` writes `<SOMEE_SQL_PASSWORD>` / `<JWT_KEY_AT_LEAST_32_BYTES>` instead of real values (dry run). `-FrontendOrigin <url>` changes the CORS origin. `-SelfContained` publishes with the .NET runtime included (`win-x86`; `-Runtime win-x64` to change), for use if the site shows *HTTP Error 500.31 / ANCM Failed to Find Native Dependencies* because the server lacks the ASP.NET Core 8 runtime.

Each run creates a new `Jwt__Key`, which signs everyone out after an upload; that is expected.

Why `web.config`: these environment variables are read by the IIS ASP.NET Core Module on any Windows host, so they work even if the Somee control panel has no page for application settings. If your Somee plan does offer such a page, you can set the same four names there instead and upload the output of a `-Placeholders` run after removing the `<environmentVariables>` block.

## 2. Upload

1. In the Somee control panel, open the website and its **File Manager** (or connect with FTP using the details the panel shows).
2. Upload the **contents** of `artifacts/publish/somee/` (not the folder itself) to the site root, replacing the old files. A zip uploaded and extracted in the File Manager also works.
3. Open `https://<your-site>.somee.com/api/categories` — it should return 5 categories. Product images are at `/catalog-gems/<file>`.
4. If the site shows an error page, temporarily set `stdoutLogEnabled="true"` in the uploaded `web.config`, create a `logs` folder, reload, and read `logs\stdout_*.log`. Turn it off afterwards.

`artifacts/publish/somee/web.config` now contains the SQL password and JWT key: never commit, share or attach it.

## 3. Database

The schema and demo data are created on the Somee database with the SQL scripts generated for hosting (SQL Server 2022-compatible, original IDs preserved). They are kept outside Git because they contain password hashes; see the local `database/hosting/README_SmarterASP.md`. `Import-SmarterASP.ps1` there takes the target as parameters:

```powershell
cd database\hosting
.\Import-SmarterASP.ps1 -Server gemaurelia.mssql.somee.com -Database gemaurelia -Login cakkonka_SQLLogin_1
```

## 4. Frontend

On Vercel set `VITE_API_BASE_URL=https://<your-site>.somee.com` and redeploy. A different or additional frontend domain must be added to CORS: re-run the script with `-FrontendOrigin`, or add `Cors__AllowedOrigins__1` to `web.config`.

## History

The backend was previously published to SmarterASP (`win8197.site4now.net`, site `gemaurelia-001-site1`). Those Visual Studio profiles were removed from the project and archived in the git-ignored `artifacts/archive/smarterasp-publish-profiles/`; they are no longer used.
