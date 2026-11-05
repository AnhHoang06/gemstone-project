<#
  Builds the Somee upload folder for the Gem Aurelia backend.
  1. dotnet publish with the Somee-Folder profile  ->  artifacts/publish/somee/   (git-ignored)
  2. checks the output (web.config, DLLs, wwwroot, 14 catalog images, no old SmarterASP hosts)
  3. writes the runtime settings into that output's web.config <environmentVariables>
     - SQL password: asked here (hidden), never saved anywhere else
     - Jwt__Key:     newly generated random key (redeploying logs users out; that is expected)
  Run from the repository root in Windows PowerShell:  .\deploy\somee\Prepare-SomeeUpload.ps1
  -Placeholders writes <SOMEE_SQL_PASSWORD>/<JWT_KEY> instead of real values (dry run, nothing secret).
  -SelfContained publishes with the .NET runtime included, if Somee lacks the ASP.NET Core 8 runtime.
#>
param(
  [string]$FrontendOrigin = 'https://gemstone-project.vercel.app',
  [string]$SqlServer = 'gemaurelia.mssql.somee.com',
  [string]$Database = 'gemaurelia',
  [string]$SqlLogin = 'cakkonka_SQLLogin_1',
  [switch]$SelfContained,
  [string]$Runtime = 'win-x86',
  [switch]$Placeholders
)
$ErrorActionPreference = 'Stop'
$repo    = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$project = Join-Path $repo 'backend\GemstoneShop\GemstoneShop\GemstoneShop.csproj'
$out     = Join-Path $repo 'artifacts\publish\somee'

"== 1. Publish (Release, net8.0, $(if ($SelfContained) { "self-contained $Runtime" } else { 'framework-dependent' }))"
# Start from an empty folder so no file (or secret) from a previous run is left behind.
if (Test-Path $out) { Remove-Item -Recurse -Force $out -Confirm:$false }
$publishArgs = @('publish', $project, '-c', 'Release', '-p:PublishProfile=Somee-Folder', '-o', $out, '--nologo', '-p:NuGetAudit=false')
if ($SelfContained) { $publishArgs += @('-r', $Runtime, '--self-contained', 'true') }
& dotnet @publishArgs
if ($LASTEXITCODE) { throw 'dotnet publish failed' }

"== 2. Check output: $out"
$required = 'web.config', 'GemstoneShop.dll', 'GemstoneShop.deps.json', 'GemstoneShop.runtimeconfig.json', 'Microsoft.Data.SqlClient.dll', 'Microsoft.EntityFrameworkCore.SqlServer.dll', 'QRCoder.dll', 'BCrypt-Net-Next.dll'
$missing = @($required | Where-Object { -not (Test-Path (Join-Path $out $_)) })
if ($missing) { throw "missing in publish output: $($missing -join ', ')" }
$images = @(Get-ChildItem (Join-Path $out 'wwwroot\catalog-gems') -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -match '^\.(jpe?g|png|webp)$' })
if ($images.Count -ne 14) { throw "expected 14 catalog images, found $($images.Count)" }
$old = @(Get-ChildItem $out -Recurse -File | Where-Object { $_.Length -lt 20MB } | Select-String -Pattern 'site4now|win8197|sql8006|db_ad0bd9|ktempurl|gemaurelia-001-site1' -List)
if ($old) { throw "old SmarterASP reference in output: $($old.Path -join ', ')" }
"required files OK, catalog images: $($images.Count), SmarterASP references: 0"

"== 3. Runtime settings in web.config"
if ($Placeholders) { $password = '<SOMEE_SQL_PASSWORD>'; $jwt = '<JWT_KEY_AT_LEAST_32_BYTES>' }
else {
  $secure = Read-Host "SQL password for $SqlLogin on $SqlServer" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if (-not $password) { throw 'empty password' }
  $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwt = [Convert]::ToBase64String($bytes)
}
# The builder quotes the password correctly even if it contains ; or quotes.
$cs = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$cs['Server'] = $SqlServer; $cs['Database'] = $Database; $cs['User ID'] = $SqlLogin; $cs['Password'] = $password
$cs['Encrypt'] = $true; $cs['TrustServerCertificate'] = $true; $cs['MultipleActiveResultSets'] = $false

$webConfig = Join-Path $out 'web.config'
[xml]$xml = Get-Content $webConfig -Raw
$core = $xml.SelectSingleNode('//system.webServer/aspNetCore')
if (-not $core) { throw 'aspNetCore element not found in web.config' }
$envs = $core.SelectSingleNode('environmentVariables')
if ($envs) { [void]$core.RemoveChild($envs) }
$envs = $xml.CreateElement('environmentVariables'); [void]$core.AppendChild($envs)
$values = [ordered]@{
  'ASPNETCORE_ENVIRONMENT'               = 'Production'
  'ConnectionStrings__DefaultConnection' = $cs.ConnectionString
  'Jwt__Key'                             = $jwt
  'Cors__AllowedOrigins__0'              = $FrontendOrigin.TrimEnd('/')
}
foreach ($k in $values.Keys) { $e = $xml.CreateElement('environmentVariable'); $e.SetAttribute('name', $k); $e.SetAttribute('value', $values[$k]); [void]$envs.AppendChild($e) }
$xml.Save($webConfig)
$password = $null; $jwt = $null; $cs = $null
"web.config environment variables set: $($values.Keys -join ', ')"
"CORS origin: $($values['Cors__AllowedOrigins__0'])"
if ($Placeholders) { "Placeholders only - replace <SOMEE_SQL_PASSWORD> and <JWT_KEY_AT_LEAST_32_BYTES> before uploading." }
"== Ready to upload: $out"
"Upload the CONTENTS of this folder to the Somee site root. Do not commit it; it now contains secrets."
