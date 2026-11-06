[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$SubscriptionId = 'ebaf0ea0-102e-4e89-a445-fc4c4fd9c5da',
  [string]$ResourceGroup = 'bantai-pilot-pr112',
  [string]$Prefix = 'bantai-pilot',
  [string]$AzPath = 'C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\azure-cli\bin\az.cmd',
  [string]$AzureConfigDirectory = 'C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\azure-release-pr112-config',
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ExpectedSha = 'b5dd8707f55d27314e1ed780ab619448d435f063'
$ManagedBy = 'bantai-release-pr112'
$env:AZURE_CONFIG_DIR = $AzureConfigDirectory

function Invoke-Az([Parameter(ValueFromRemainingArguments)] [string[]]$Arguments) {
  & $AzPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    $summary = $Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' '
    throw "Azure CLI command failed: $summary."
  }
}

function Invoke-AzText([Parameter(ValueFromRemainingArguments)] [string[]]$Arguments) {
  $output = & $AzPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    $summary = $Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' '
    throw "Azure CLI command failed: $summary."
  }
  return ($output | Out-String).Trim()
}

function Assert-OwnedResource([System.Collections.IDictionary]$Resource, [string]$ExpectedName, [string]$ExpectedType) {
  if ([string]$Resource.name -cne $ExpectedName -or [string]$Resource.type -cne $ExpectedType) {
    throw "Unexpected resource target: $($Resource.type)/$($Resource.name)."
  }
  $tags = [System.Collections.IDictionary]$Resource.tags
  $required = [ordered]@{
    application = 'bantai'
    environment = 'restricted-pilot'
    sourceSha = $ExpectedSha
    managedBy = $ManagedBy
    resourcePrefix = $Prefix
  }
  foreach ($entry in $required.GetEnumerator()) {
    if (-not $tags.ContainsKey($entry.Key) -or [string]$tags[$entry.Key] -cne $entry.Value) {
      throw "Refusing to modify $ExpectedType/$ExpectedName because ownership tag '$($entry.Key)' does not match."
    }
  }
}

if (-not (Test-Path -LiteralPath $AzPath -PathType Leaf)) { throw "Azure CLI not found: $AzPath" }
$account = Invoke-AzText account show --query '{id:id,state:state}' --output json | ConvertFrom-Json -AsHashtable
if ($account.id -ne $SubscriptionId -or $account.state -ne 'Enabled') { throw "Azure CLI must be signed in to enabled subscription $SubscriptionId." }
Invoke-Az account set --subscription $SubscriptionId

$groupExists = (Invoke-AzText group exists --name $ResourceGroup --output tsv) -eq 'true'
if (-not $groupExists) { throw "Resource group not found: $ResourceGroup" }
$group = Invoke-AzText group show --name $ResourceGroup --query tags --output json | ConvertFrom-Json -AsHashtable
$groupRequirements = [ordered]@{
  application = 'bantai'
  environment = 'restricted-pilot'
  sourceSha = $ExpectedSha
  managedBy = $ManagedBy
  resourcePrefix = $Prefix
}
foreach ($entry in $groupRequirements.GetEnumerator()) {
  if (-not $group.ContainsKey($entry.Key) -or [string]$group[$entry.Key] -cne $entry.Value) {
    throw "Resource group identity tag '$($entry.Key)' does not match this restricted pilot."
  }
}
$expiry = [DateTimeOffset]::Parse([string]$group.expiresAt).ToUniversalTime()
if (-not $Force -and [DateTimeOffset]::UtcNow -lt $expiry) {
  throw "Pilot has not reached its tagged expiry $($expiry.ToString('o')). Use -Force only for an intentional early stop."
}

$allResourcesJson = Invoke-AzText resource list --resource-group $ResourceGroup --query '[].{id:id,name:name,type:type,tags:tags}' --output json
$allResources = @($allResourcesJson | ConvertFrom-Json -AsHashtable)
$temporaryTypes = @('Microsoft.App/containerApps','Microsoft.App/jobs','Microsoft.App/managedEnvironments')
$temporary = @($allResources | Where-Object { [string]$_.type -in $temporaryTypes })
$expectedTargets = [ordered]@{
  'Microsoft.App/containerApps' = @("$Prefix-ai", "$Prefix-backend", "$Prefix-web")
  'Microsoft.App/jobs' = @("$Prefix-migrate", "$Prefix-db-init")
  'Microsoft.App/managedEnvironments' = @("$Prefix-apps")
}

foreach ($resource in $temporary) {
  $expectedNames = $expectedTargets[[string]$resource.type]
  if ([string]$resource.name -notin $expectedNames) {
    throw "Unexpected temporary resource in the pilot group; nothing was deleted: $($resource.type)/$($resource.name)."
  }
  Assert-OwnedResource $resource ([string]$resource.name) ([string]$resource.type)
}

foreach ($type in $expectedTargets.Keys) {
  foreach ($name in $expectedTargets[$type]) {
    $resource = @($temporary | Where-Object { [string]$_.type -ceq $type -and [string]$_.name -ceq $name })
    if ($resource.Count -eq 1 -and $PSCmdlet.ShouldProcess("$type/$name", 'Delete')) {
      switch ($type) {
        'Microsoft.App/containerApps' { Invoke-Az containerapp delete --resource-group $ResourceGroup --name $name --yes --only-show-errors --output none }
        'Microsoft.App/jobs' { Invoke-Az containerapp job delete --resource-group $ResourceGroup --name $name --yes --only-show-errors --output none }
        'Microsoft.App/managedEnvironments' { Invoke-Az containerapp env delete --resource-group $ResourceGroup --name $name --yes --only-show-errors --output none }
      }
    }
  }
}

$postgres = @($allResources | Where-Object { [string]$_.type -ceq 'Microsoft.DBforPostgreSQL/flexibleServers' })
if ($postgres.Count -gt 1) { throw 'More than one PostgreSQL server exists in the pilot group; nothing further was modified.' }
if ($postgres.Count -eq 1) {
  if (-not ([string]$postgres[0].name).StartsWith("$Prefix-pg-")) { throw 'PostgreSQL server name is outside the pilot prefix.' }
  Assert-OwnedResource $postgres[0] ([string]$postgres[0].name) 'Microsoft.DBforPostgreSQL/flexibleServers'
  if ($PSCmdlet.ShouldProcess("PostgreSQL server $($postgres[0].name)", 'Stop compute')) {
    Invoke-Az postgres flexible-server stop --resource-group $ResourceGroup --name ([string]$postgres[0].name) --only-show-errors --output none
  }
}

if (-not $WhatIfPreference) {
  $deadline = [DateTimeOffset]::UtcNow.AddMinutes(8)
  do {
    $remainingJson = Invoke-AzText resource list --resource-group $ResourceGroup --query "[?type=='Microsoft.App/containerApps' || type=='Microsoft.App/jobs' || type=='Microsoft.App/managedEnvironments'].{name:name,type:type}" --output json
    $remaining = @($remainingJson | ConvertFrom-Json -AsHashtable)
    if ($remaining.Count -eq 0) { break }
    Start-Sleep -Seconds 10
  } while ([DateTimeOffset]::UtcNow -lt $deadline)
  if ($remaining.Count -ne 0) { throw 'Temporary app, job, or environment resources remain after the scoped stop.' }
}

[pscustomobject]@{
  resourceGroup = $ResourceGroup
  temporaryComputeRemoved = -not $WhatIfPreference
  postgresComputeStopRequested = ($postgres.Count -eq 1 -and -not $WhatIfPreference)
  preserved = @('private PostgreSQL data','VNet and private DNS','Key Vaults','ACR images','managed identities','Log Analytics workspace')
  note = 'Retained resources can still incur storage, registry, vault, DNS, and log charges. PostgreSQL may auto-restart after the Azure service stop limit.'
}
