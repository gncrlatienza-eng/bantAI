[CmdletBinding()]
param(
  [Parameter(Mandatory)][DateTimeOffset]$StopAtUtc,
  [Parameter(Mandatory)][string]$SubscriptionId,
  [Parameter(Mandatory)][string]$ResourceGroup,
  [Parameter(Mandatory)][string]$Prefix,
  [Parameter(Mandatory)][string]$StopScriptPath,
  [Parameter(Mandatory)][string]$AzPath,
  [Parameter(Mandatory)][string]$AzureConfigDirectory,
  [Parameter(Mandatory)][string]$LogPath,
  [Parameter(Mandatory)][string]$ReadyPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:AZURE_CONFIG_DIR = $AzureConfigDirectory

function Write-SupervisorLog([string]$Message) {
  $line = '{0} {1}' -f [DateTimeOffset]::UtcNow.ToString('o'), $Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

try {
  Write-SupervisorLog "Stop supervisor armed for $($StopAtUtc.ToUniversalTime().ToString('o'))."
  $ready = [ordered]@{
    pid = $PID
    resourceGroup = $ResourceGroup
    expiresAt = $StopAtUtc.ToUniversalTime().ToString('o')
  } | ConvertTo-Json
  [IO.File]::WriteAllText($ReadyPath, $ready, [Text.UTF8Encoding]::new($false))
  while ([DateTimeOffset]::UtcNow -lt $StopAtUtc.ToUniversalTime()) {
    $remainingSeconds = [Math]::Ceiling(($StopAtUtc.ToUniversalTime() - [DateTimeOffset]::UtcNow).TotalSeconds)
    Start-Sleep -Seconds ([Math]::Max(1, [Math]::Min(30, $remainingSeconds)))
  }
  Write-SupervisorLog 'Expiry reached; invoking scoped pilot teardown.'
  $result = & $StopScriptPath -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Prefix $Prefix -AzPath $AzPath -AzureConfigDirectory $AzureConfigDirectory 2>&1 | Out-String
  Write-SupervisorLog $result.Trim()
  Write-SupervisorLog 'Scoped pilot teardown completed.'
  exit 0
} catch {
  Write-SupervisorLog "ERROR: $($_.Exception.Message)"
  exit 1
}
