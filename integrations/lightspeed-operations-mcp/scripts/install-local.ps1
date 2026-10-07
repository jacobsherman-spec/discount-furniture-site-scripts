[CmdletBinding()]
param(
    [string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "DiscountFurniture\lightspeed-ops\app")
)

$ErrorActionPreference = "Stop"
$packageRoot = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $packageRoot "dist\server.mjs"
if (-not (Test-Path -LiteralPath $bundlePath)) {
    throw "Built MCP bundle not found at $bundlePath. Run pnpm build first."
}

[IO.Directory]::CreateDirectory($InstallDirectory) | Out-Null
Copy-Item -LiteralPath $bundlePath -Destination (Join-Path $InstallDirectory "server.mjs") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "configure-credential.ps1") -Destination (Join-Path $InstallDirectory "configure-credential.ps1") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "read-credential.ps1") -Destination (Join-Path $InstallDirectory "read-credential.ps1") -Force

Write-Host "Discount Furniture Lightspeed MCP installed at $InstallDirectory"
Write-Host "No credential was copied or changed."
