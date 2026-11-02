[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$CredentialPath,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9-]+$')][string]$PipeName
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$entropyText = "DiscountFurniture.LightspeedOperations.v1"
$protectedBytes = $null
$plainBytes = $null
$pipe = $null

try {
    $encoded = [IO.File]::ReadAllText($CredentialPath).Trim()
    $protectedBytes = [Convert]::FromBase64String($encoded)
    $entropyBytes = [Text.Encoding]::UTF8.GetBytes($entropyText)
    $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $protectedBytes,
        $entropyBytes,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    $pipe = New-Object IO.Pipes.NamedPipeClientStream(
        ".",
        $PipeName,
        [IO.Pipes.PipeDirection]::Out,
        [IO.Pipes.PipeOptions]::WriteThrough
    )
    $pipe.Connect(10000)
    $pipe.Write($plainBytes, 0, $plainBytes.Length)
    $pipe.Flush()
}
finally {
    if ($pipe) { $pipe.Dispose() }
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
    if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
}
