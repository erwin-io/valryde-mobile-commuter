#requires -Version 7.0
<#
Runs only the approved local valryde_ui_dev acceptance target.
Password is prompted securely, sent in the child's environment (not arguments), and never saved.
Example: pwsh -NoProfile -File ./scripts/Invoke-CommuterAcceptance.ps1 -ConfirmIsolatedUiDatabase
Add -TestRateLimit to consume the seeded commuter account's one-minute place-search quota at the end.
#>
[CmdletBinding()]
param(
    [uri]$ApiOrigin = 'http://127.0.0.1:3000',
    [switch]$ConfirmIsolatedUiDatabase,
    [switch]$TestRateLimit,
    [string]$PlaywrightModule
)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmIsolatedUiDatabase) { throw 'Confirm that this API is attached only to valryde_ui_dev using -ConfirmIsolatedUiDatabase.' }
if ($ApiOrigin.Scheme -ne 'http' -or $ApiOrigin.Host -notin @('127.0.0.1', 'localhost', '[::1]') -or $ApiOrigin.Port -ne 3000 -or $ApiOrigin.UserInfo -or $ApiOrigin.Query -or $ApiOrigin.Fragment) {
    throw 'Only the approved local HTTP API on port 3000 is accepted.'
}
$repoPath = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'verify-real-backend.cjs'
$secret = $null
$secretPointer = [IntPtr]::Zero
$child = $null
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$credentialNames = @('VALRYDE_FIXTURE_EMAIL', 'VALRYDE_FIXTURE_PASSWORD')
try {
    $secret = Read-Host 'Seeded commuter fixture password (not saved)' -AsSecureString
    if ($secret.Length -eq 0) { throw 'A nonempty fixture password is required.' }
    $startInfo.FileName = (Get-Command node -ErrorAction Stop).Source
    $startInfo.WorkingDirectory = $repoPath
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add($runnerPath)
    $startInfo.Environment['VALRYDE_ACCEPTANCE_API_ORIGIN'] = $ApiOrigin.GetLeftPart([UriPartial]::Authority)
    $startInfo.Environment['VALRYDE_ACCEPTANCE_DATABASE'] = 'valryde_ui_dev'
    $startInfo.Environment['VALRYDE_FIXTURE_EMAIL'] = 'dev.commuter@valryde.test'
    $startInfo.Environment['VALRYDE_ACCEPTANCE_RATE_LIMIT'] = $(if ($TestRateLimit) { '1' } else { '0' })
    if ($PlaywrightModule) { $startInfo.Environment['PLAYWRIGHT_MODULE'] = $PlaywrightModule }
    elseif (-not $startInfo.Environment['PLAYWRIGHT_MODULE']) {
        $bundledModule = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
        if (Test-Path -LiteralPath $bundledModule) { $startInfo.Environment['PLAYWRIGHT_MODULE'] = $bundledModule }
    }
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $startInfo.Environment['VALRYDE_FIXTURE_PASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $child = [Diagnostics.Process]::new()
    $child.StartInfo = $startInfo
    if (-not $child.Start()) { throw 'Acceptance child process did not start.' }
    # The child now owns its process environment. Remove the launcher's plaintext references promptly.
    foreach ($name in $credentialNames) { [void]$startInfo.Environment.Remove($name) }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $secretPointer = [IntPtr]::Zero
    $secret.Dispose()
    $secret = $null
    $child.WaitForExit()
    $childExitCode = $child.ExitCode
}
finally {
    foreach ($name in $credentialNames) {
        [void]$startInfo.Environment.Remove($name)
        Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
    [void]$startInfo.Environment.Remove('VALRYDE_ACCEPTANCE_API_ORIGIN')
    [void]$startInfo.Environment.Remove('VALRYDE_ACCEPTANCE_DATABASE')
    [void]$startInfo.Environment.Remove('VALRYDE_ACCEPTANCE_RATE_LIMIT')
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    if ($secret) { $secret.Dispose() }
    if ($child) { $child.Dispose() }
}
exit $childExitCode
