[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $packageRoot 'scripts\install-local.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('df-connector-install-test-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
$testApp = Join-Path $testRoot 'app'
$sentinelPath = Join-Path $testRoot 'credential.dpapi'
[IO.File]::WriteAllText($sentinelPath, 'SYNTHETIC INSTALLER TEST; NOT A CREDENTIAL')
$sentinelHash = (Get-FileHash -LiteralPath $sentinelPath).Hash

$first = & $installer -InstallDirectory $testApp | ConvertFrom-Json
if ($first.previous_release) { throw 'First installation unexpectedly claimed a previous release.' }
$firstHash = (Get-FileHash -LiteralPath (Join-Path $testApp 'server.mjs')).Hash
$second = & $installer -InstallDirectory $testApp | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $second.previous_release -PathType Container)) { throw 'Upgrade did not preserve the previous app.' }
$rollback = & $installer -InstallDirectory $testApp -RollbackTo $second.previous_release | ConvertFrom-Json
if ((Get-FileHash -LiteralPath (Join-Path $testApp 'server.mjs')).Hash -ne $firstHash) { throw 'Rollback did not restore the original bundle.' }
if ((Get-FileHash -LiteralPath $sentinelPath).Hash -ne $sentinelHash) { throw 'Installer touched the separate protected-credential path.' }

$manifest = Get-Content -LiteralPath (Join-Path $testApp 'installation.json') -Raw | ConvertFrom-Json
foreach ($file in $manifest.files.PSObject.Properties) {
    if ((Get-FileHash -LiteralPath (Join-Path $testApp $file.Name)).Hash.ToLowerInvariant() -ne $file.Value) { throw "Manifest mismatch: $($file.Name)" }
}
if ($manifest.registry_sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Catalog fingerprint is missing.' }
try {
    & $installer -InstallDirectory $testApp -RollbackTo (Join-Path $testRoot 'app-backup-missing') | Out-Null
    throw 'MISSING_BACKUP_ACCEPTED'
} catch {
    if ($_.Exception.Message -eq 'MISSING_BACKUP_ACCEPTED') { throw }
}
if ((Get-FileHash -LiteralPath (Join-Path $testApp 'server.mjs')).Hash -ne $firstHash) { throw 'Failed rollback changed the active app.' }
[pscustomobject]@{ ok = $true; install = 'passed'; upgrade = 'passed'; rollback = 'passed'; failed_rollback_preserved_app = $true; credential_untouched = $true; test_directory = $testRoot } | ConvertTo-Json
