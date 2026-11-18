[CmdletBinding()]
param(
    [string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "DiscountFurniture\lightspeed-ops\app"),
    [string]$RollbackTo
)

$ErrorActionPreference = "Stop"
$packageRoot = Split-Path -Parent $PSScriptRoot
$installPath = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar)
if ((Split-Path -Leaf $installPath) -ne "app") { throw "InstallDirectory must be the dedicated app directory, never a workspace or profile root." }
$parentPath = Split-Path -Parent $installPath
[IO.Directory]::CreateDirectory($parentPath) | Out-Null
$suffix = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$stagePath = Join-Path $parentPath ("app-stage-" + $suffix)
$backupPath = Join-Path $parentPath ("app-backup-" + $suffix)

if ($RollbackTo) {
    $restorePath = [IO.Path]::GetFullPath($RollbackTo).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ((Split-Path -Parent $restorePath) -ne $parentPath -or (Split-Path -Leaf $restorePath) -notlike 'app-backup-*') {
        throw "RollbackTo must name an app-backup-* directory beside the installed app."
    }
    foreach ($name in @('server.mjs','read-credential.ps1','configure-credential.ps1')) {
        if (-not (Test-Path -LiteralPath (Join-Path $restorePath $name) -PathType Leaf)) { throw "Incomplete rollback snapshot: $name" }
    }
    Copy-Item -LiteralPath $restorePath -Destination $stagePath -Recurse
} else {
    $files = [ordered]@{
        'server.mjs' = (Join-Path $packageRoot 'dist\server.mjs')
        'configure-credential.ps1' = (Join-Path $PSScriptRoot 'configure-credential.ps1')
        'read-credential.ps1' = (Join-Path $PSScriptRoot 'read-credential.ps1')
    }
    foreach ($source in $files.Values) {
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing release file: $source. Run pnpm build first." }
    }
    [IO.Directory]::CreateDirectory($stagePath) | Out-Null
    $hashes = [ordered]@{}
    foreach ($name in $files.Keys) {
        $destination = Join-Path $stagePath $name
        Copy-Item -LiteralPath $files[$name] -Destination $destination
        $hashes[$name] = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hashes[$name] -ne (Get-FileHash -LiteralPath $files[$name] -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Copy verification failed for $name" }
    }
    $package = Get-Content -LiteralPath (Join-Path $packageRoot 'package.json') -Raw | ConvertFrom-Json
    $registryPath = Join-Path $packageRoot 'src\operations-registry.js'
    $hashScript = Join-Path $PSScriptRoot 'registry-catalog-hash.mjs'
    if (-not (Test-Path -LiteralPath $hashScript -PathType Leaf)) { throw "Missing registry hash helper: $hashScript" }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw "node.exe is required to calculate the runtime registry fingerprint." }
    $registryHashOutput = @(& $nodeCommand.Source $hashScript $registryPath 2>&1)
    $registryHashExit = $LASTEXITCODE
    $registryHash = $(if ($registryHashOutput.Count -gt 0) { ($registryHashOutput | Select-Object -Last 1).ToString().Trim() } else { "" })
    if ($registryHashExit -ne 0 -or $registryHash -notmatch '^[a-f0-9]{64}$') {
        throw "Runtime registry fingerprint failed."
    }

    $commit = $null
    $dirty = $null
    $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($gitCommand) {
        $commitOutput = @(& $gitCommand.Source -C $packageRoot rev-parse HEAD 2>$null)
        $commitExit = $LASTEXITCODE
        if ($commitExit -eq 0 -and $commitOutput.Count -gt 0) {
            $candidateCommit = ($commitOutput | Select-Object -First 1).ToString().Trim()
            if ($candidateCommit -match '^[a-fA-F0-9]{40,64}$') { $commit = $candidateCommit.ToLowerInvariant() }
        }
        $statusOutput = @(& $gitCommand.Source -C $packageRoot status --porcelain -- . 2>$null)
        $statusExit = $LASTEXITCODE
        if ($statusExit -eq 0) { $dirty = $statusOutput.Count -gt 0 }
    }
    $manifest = [ordered]@{
        schema_version = 1; connector_version = $package.version; installed_at = (Get-Date).ToUniversalTime().ToString('o')
        git_commit = $commit; source_dirty = $dirty; files = $hashes
        registry_sha256 = $registryHash
        registry_file_sha256 = (Get-FileHash -LiteralPath $registryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    [IO.File]::WriteAllText((Join-Path $stagePath 'installation.json'), ($manifest | ConvertTo-Json -Depth 6) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

# All move targets are validated dedicated sibling directories. Preserve the old
# app in full, including legacy launchers, without carrying stale files forward.
$hadPrevious = Test-Path -LiteralPath $installPath -PathType Container
try {
    if ($hadPrevious) { Move-Item -LiteralPath $installPath -Destination $backupPath }
    Move-Item -LiteralPath $stagePath -Destination $installPath
} catch {
    if ($hadPrevious -and (Test-Path -LiteralPath $backupPath) -and -not (Test-Path -LiteralPath $installPath)) {
        Move-Item -LiteralPath $backupPath -Destination $installPath
    }
    throw
}

[pscustomobject]@{
    installed_at = $installPath
    previous_release = $(if ($hadPrevious) { $backupPath } else { $null })
    rollback_source = $RollbackTo
    credential_changed = $false
    next_action = 'Open a new Codex task or reload the app, then compare lightspeed_connection_status runtime hashes with installation.json.'
} | ConvertTo-Json
