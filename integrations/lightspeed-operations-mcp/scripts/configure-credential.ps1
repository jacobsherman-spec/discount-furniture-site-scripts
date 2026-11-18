[CmdletBinding()]
param(
    [string]$RetailerDomainPrefix = "discountfurniture",
    [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "DiscountFurniture\lightspeed-ops\credential.dpapi"),
    [switch]$Replace,
    [switch]$FromClipboard
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$entropyText = "DiscountFurniture.LightspeedOperations.v1"
$credentialDirectory = Split-Path -Parent $CredentialPath
$temporaryPath = $null
$secureToken = $null
$tokenBstr = [IntPtr]::Zero
$plainToken = $null
$plainBytes = $null
$protectedBytes = $null
$signingBytes = $null

if ($RetailerDomainPrefix -notmatch '^[A-Za-z0-9-]+$') {
    throw "RetailerDomainPrefix must contain only letters, numbers, and hyphens."
}
if ((Test-Path -LiteralPath $CredentialPath) -and -not $Replace) {
    throw "A protected credential already exists at $CredentialPath. Use -Replace only for an intentional credential rotation."
}

try {
    if ($FromClipboard) {
        if (-not (Get-Command Get-Clipboard -ErrorAction SilentlyContinue)) {
            throw "Clipboard capture is unavailable; rerun without -FromClipboard for hidden manual entry."
        }
        $plainToken = Get-Clipboard -Raw -ErrorAction Stop
    }
    else {
        Write-Host "Paste the one-time Lightspeed token below. Input is hidden and will not be echoed."
        $secureToken = Read-Host "Lightspeed token" -AsSecureString
        $tokenBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenBstr)
    }
    if ([string]::IsNullOrWhiteSpace($plainToken) -or $plainToken.Length -lt 20) {
        throw "The token was empty or unexpectedly short; no credential file was written."
    }

    $signingBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($signingBytes) } finally { $rng.Dispose() }
    $signingKey = [Convert]::ToBase64String($signingBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

    $bundle = [ordered]@{
        version = 1
        retailer_domain_prefix = $RetailerDomainPrefix.ToLowerInvariant()
        token = $plainToken.Trim()
        signing_key = $signingKey
        created_at = [DateTime]::UtcNow.ToString("o")
    }
    $json = $bundle | ConvertTo-Json -Compress
    $plainBytes = [Text.Encoding]::UTF8.GetBytes($json)
    $entropyBytes = [Text.Encoding]::UTF8.GetBytes($entropyText)
    $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
        $plainBytes,
        $entropyBytes,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    [IO.Directory]::CreateDirectory($credentialDirectory) | Out-Null
    $temporaryPath = Join-Path $credentialDirectory ("credential-" + [Guid]::NewGuid().ToString("N") + ".tmp")
    [IO.File]::WriteAllText(
        $temporaryPath,
        [Convert]::ToBase64String($protectedBytes),
        (New-Object Text.UTF8Encoding($false))
    )
    Move-Item -LiteralPath $temporaryPath -Destination $CredentialPath -Force:$Replace
    $temporaryPath = $null

    $clipboardCleared = $false
    try {
        if ((Get-Command Get-Clipboard -ErrorAction SilentlyContinue) -and (Get-Command Set-Clipboard -ErrorAction SilentlyContinue)) {
            $clipboardText = Get-Clipboard -Raw -ErrorAction Stop
            if ($clipboardText -and $clipboardText.Trim() -ceq $plainToken.Trim()) {
                Set-Clipboard -Value ""
                $clipboardCleared = $true
            }
            $clipboardText = $null
        }
    }
    catch {
        # Clipboard cleanup is best-effort; it must never interfere with the encrypted save.
    }

    Write-Host "Protected Lightspeed credential saved for Windows user $env:USERNAME."
    Write-Host "Retailer domain: $($bundle.retailer_domain_prefix).retail.lightspeed.app"
    Write-Host "Credential path: $CredentialPath"
    Write-Host "The token was not printed or stored in plaintext."
    if ($clipboardCleared) { Write-Host "Matching token contents were cleared from the Windows clipboard." }
}
finally {
    if ($temporaryPath -and (Test-Path -LiteralPath $temporaryPath)) {
        Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
    }
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
    if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
    if ($signingBytes) { [Array]::Clear($signingBytes, 0, $signingBytes.Length) }
    if ($tokenBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr) }
    $plainToken = $null
    $secureToken = $null
}
