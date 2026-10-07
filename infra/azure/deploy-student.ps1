[CmdletBinding()]
param(
  [string]$SubscriptionId = 'ebaf0ea0-102e-4e89-a445-fc4c4fd9c5da',
  [string]$ResourceGroup = 'bantai-student-pr112',
  [string]$Location = 'eastasia',
  [string]$Prefix = 'bantai-student',
  [string]$Operator = 'Reymark',
  [string]$BackendSecretsPath,
  [string]$AiSecretsPath,
  [Parameter(Mandatory)][SecureString]$PostgresAdminPassword,
  [Parameter(Mandatory)][SecureString]$DatabaseAppPassword,
  [Parameter(Mandatory)][string]$ModelDirectory,
  [Parameter(Mandatory)][string]$ApprovalManifestPath,
  [string]$BackendLocalImage = 'bantai-backend:b5dd870-student',
  [string]$AiBaseLocalImage = 'bantai-ai:b5dd870-student',
  [string]$WebLocalImage = 'bantai-web:b5dd870-student',
  [string]$MigrationLocalImage = 'bantai-migrate:b5dd870-student',
  [string]$DbInitLocalImage = 'bantai-db-init:b5dd870',
  [switch]$EnableCampaignMatching,
  [switch]$FoundationOnly,
  [switch]$ValidateOnly,
  [DateTimeOffset]$ReviewAfterUtc = '2026-12-15T00:00:00Z',
  [string]$AzPath = 'C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\azure-cli\bin\az.cmd',
  [string]$AzureConfigDirectory = 'C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\azure-release-pr112-config',
  [string]$SupervisorStateDirectory = 'C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\release-pr112'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedSourceSha = 'b5dd8707f55d27314e1ed780ab619448d435f063'
$ExpectedApprovalSha256 = '4ca09e210aa42c7b0c180e79d3fb46dd336455c02120d4503119829a5d6ed78b'
$ExpectedModelVersion = 'candidate-2026-09-21-colab-C-local'
$ManagedBy = 'bantai-student-pr112'
$TemplatePath = Join-Path $PSScriptRoot 'student.bicep'
$TempParametersPath = Join-Path ([IO.Path]::GetTempPath()) ("bantai-student-{0}.parameters.json" -f [Guid]::NewGuid())
$ApprovalContext = Join-Path ([IO.Path]::GetTempPath()) ("bantai-approved-manifest-{0}" -f [Guid]::NewGuid())
$env:AZURE_CONFIG_DIR = $AzureConfigDirectory

function ConvertFrom-SecureStringPlainText([SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-Az([Parameter(ValueFromRemainingArguments)] [string[]]$Arguments) {
  $cliPython = Join-Path (Split-Path -Parent $AzPath) '..\python.exe'
  if (Test-Path -LiteralPath $cliPython) { & $cliPython -IBm azure.cli @Arguments }
  else { & $AzPath @Arguments }
  if ($LASTEXITCODE -ne 0) {
    $summary = $Arguments[0..([Math]::Min(1, $Arguments.Count - 1))] -join ' '
    throw "Azure CLI command failed: $summary."
  }
}

function Invoke-AzText([Parameter(ValueFromRemainingArguments)] [string[]]$Arguments) {
  $cliPython = Join-Path (Split-Path -Parent $AzPath) '..\python.exe'
  $output = if (Test-Path -LiteralPath $cliPython) { & $cliPython -IBm azure.cli @Arguments }
  else { & $AzPath @Arguments }
  if ($LASTEXITCODE -ne 0) {
    $summary = $Arguments[0..([Math]::Min(1, $Arguments.Count - 1))] -join ' '
    throw "Azure CLI command failed: $summary."
  }
  return ($output | Out-String).Trim()
}

function Invoke-Native([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed." }
}

function Publish-Image([string]$Image) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    & docker push --quiet $Image
    if ($LASTEXITCODE -eq 0) { return }
    if ($attempt -eq 3) { throw "Image upload failed after three attempts: $Image" }
    Write-Warning "Image upload interrupted; retrying attempt $($attempt + 1) of 3."
    Start-Sleep -Seconds (10 * $attempt)
  }
}
function Assert-ImagePresent([string]$Image) {
  docker image inspect $Image *> $null
  if ($LASTEXITCODE -ne 0) { throw "Required local image is missing: $Image" }
}

function Assert-SecretObject([System.Collections.IDictionary]$Object, [string[]]$RequiredNames) {
  foreach ($name in $RequiredNames) {
    if (-not $Object.ContainsKey($name) -or [string]::IsNullOrWhiteSpace([string]$Object[$name]) -or [string]$Object[$name] -match '^REPLACE') {
      throw "Secret input is missing a non-placeholder '$name' value."
    }
  }
}

function Assert-ModelApproval {
  if ([IO.Path]::GetFileName($ApprovalManifestPath) -cne 'model-approval.json') {
    throw 'The approval manifest must be named model-approval.json.'
  }
  $approvalItem = Get-Item -LiteralPath $ApprovalManifestPath -Force
  $modelDirectoryItem = Get-Item -LiteralPath $ModelDirectory -Force
  if (($approvalItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($modelDirectoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Approval manifest and Model-C directory must not be reparse points.'
  }
  $manifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ApprovalManifestPath).Hash.ToLowerInvariant()
  if ($manifestHash -cne $ExpectedApprovalSha256) {
    throw "Approval manifest hash does not match the approved release manifest ($ExpectedApprovalSha256)."
  }
  $manifest = Get-Content -LiteralPath $ApprovalManifestPath -Raw | ConvertFrom-Json -AsHashtable
  if ($manifest.approved -ne $true -or $manifest.scope -cne 'production' -or $manifest.version_tag -cne $ExpectedModelVersion) {
    throw 'Approval manifest scope, status, or Model-C version is invalid.'
  }
  $expectedArtifacts = [ordered]@{
    'config.json' = 'f75c07a731c814da2dffe43eec21a85fa8ab9de8a3d9f7a562ba3e657eb2ba08'
    'model.safetensors' = '85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b'
    'tokenizer_config.json' = '5d84c938d902dbd684af806ccc920e4c99812d897b0f271eebf856361a4337f6'
    'tokenizer.json' = '2687cc191964de4bb7f4a43b29e7398decc0661f77e860d9c69d77a1bf6c5fdf'
    'training_args.bin' = '39d75fea78c081cec1b4e9eb657ad7e737f18eb373a42795e82894a602c91ffe'
    'version.json' = 'b634684fd6e4007bc7f07412b9ac35b4bb0562e31d28ecd334569090d830ff4c'
  }
  $modelItems = @(Get-ChildItem -LiteralPath $ModelDirectory -Force)
  $unexpected = @($modelItems | Where-Object { $_.PSIsContainer -or ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $_.Name -notin @($expectedArtifacts.Keys) })
  $missing = @($expectedArtifacts.Keys | Where-Object { $_ -notin @($modelItems.Name) })
  if ($modelItems.Count -ne $expectedArtifacts.Count -or $unexpected.Count -ne 0 -or $missing.Count -ne 0) {
    throw 'Model-C directory must contain exactly the six hash-pinned approved artifacts and no directories or reparse points.'
  }
  $manifestNames = @($manifest.artifacts.Keys)
  if ($manifestNames.Count -ne $expectedArtifacts.Count -or @($manifestNames | Where-Object { $_ -notin @($expectedArtifacts.Keys) }).Count -ne 0) {
    throw 'Approval manifest must bind exactly the six approved Model-C artifacts.'
  }
  foreach ($artifact in $expectedArtifacts.GetEnumerator()) {
    $artifactPath = Join-Path $ModelDirectory $artifact.Key
    if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) { throw "Approved Model-C artifact is missing: $($artifact.Key)" }
    if (-not $manifest.artifacts.ContainsKey($artifact.Key) -or [string]$manifest.artifacts[$artifact.Key] -cne $artifact.Value) {
      throw "Approval manifest does not bind the approved hash for $($artifact.Key)."
    }
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath).Hash.ToLowerInvariant()
    if ($actualHash -cne $artifact.Value) { throw "Model-C artifact hash mismatch: $($artifact.Key)" }
  }
  if ($EnableCampaignMatching) {
    throw 'Campaign matching requires a new approved manifest that hash-pins campaign_space.json; the current six-file approval cannot enable it.'
  }
  return $manifestHash
}

function Write-ParameterFile(
  [bool]$DeploySecrets,
  [bool]$DeployJobs,
  [bool]$DeployApps,
  [System.Collections.IDictionary]$BackendSecrets,
  [System.Collections.IDictionary]$AiSecrets,
  [string]$PostgresPassword,
  [string]$AppPassword,
  [hashtable]$Images,
  [DateTimeOffset]$ReviewAfter
) {
  $payload = [ordered]@{
    '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters = [ordered]@{
      prefix = @{ value = $Prefix }
      location = @{ value = $Location }
      reviewAfter = @{ value = $ReviewAfter.ToUniversalTime().ToString('o') }
      pilotOperator = @{ value = $Operator }
      backendImage = @{ value = $Images.backend }
      aiImage = @{ value = $Images.ai }
      webImage = @{ value = $Images.web }
      migrationImage = @{ value = $Images.migration }
      dbInitImage = @{ value = $Images.dbInit }
      postgresAdminPassword = @{ value = $PostgresPassword }
      databaseAppPassword = @{ value = $AppPassword }
      backendSecrets = @{ value = $BackendSecrets }
      aiSecrets = @{ value = $AiSecrets }
      deploySecrets = @{ value = $DeploySecrets }
      deployJobs = @{ value = $DeployJobs }
      deployApps = @{ value = $DeployApps }
      enableCampaignMatching = @{ value = [bool]$EnableCampaignMatching }
    }
  }
  $json = $payload | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($TempParametersPath, $json, [Text.UTF8Encoding]::new($false))
}

function Invoke-Deployment([string]$Name) {
  Invoke-Az deployment group validate --resource-group $ResourceGroup --template-file $TemplatePath --parameters "@$TempParametersPath" --only-show-errors --output none
  Invoke-Az deployment group create --name $Name --resource-group $ResourceGroup --template-file $TemplatePath --parameters "@$TempParametersPath" --mode Incremental --only-show-errors --output none
}

function Wait-Job([string]$JobName, [string]$ExecutionName, [int]$TimeoutSeconds) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $status = Invoke-AzText containerapp job execution show --resource-group $ResourceGroup --name $JobName --job-execution-name $ExecutionName --query properties.status --output tsv
    if ($status -eq 'Succeeded') { return }
    if ($status -in @('Failed', 'Stopped', 'Degraded')) { throw "$JobName execution ended with status $status." }
    Start-Sleep -Seconds 10
  }
  throw "$JobName did not complete within $TimeoutSeconds seconds."
}

function Assert-ResourceGroupOwnership([System.Collections.IDictionary]$Tags) {
  $required = [ordered]@{
    application = 'bantai'
    environment = 'student-test'
    sourceSha = $ExpectedSourceSha
    managedBy = $ManagedBy
    resourcePrefix = $Prefix
    pilotOperator = $Operator
  }
  foreach ($entry in $required.GetEnumerator()) {
    if (-not $Tags.ContainsKey($entry.Key) -or [string]$Tags[$entry.Key] -cne $entry.Value) {
      throw "Existing resource group is not owned by this student deployment (tag '$($entry.Key)')."
    }
  }
}

foreach ($path in @($TemplatePath, $ApprovalManifestPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file not found: $path" }
}
if (-not (Test-Path -LiteralPath $ModelDirectory -PathType Container)) { throw "Model directory not found: $ModelDirectory" }
if (-not (Test-Path -LiteralPath $AzPath -PathType Leaf)) { throw "Azure CLI not found: $AzPath" }

$repoSha = (git -C (Join-Path $PSScriptRoot '..\..') rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $repoSha -ne $ExpectedSourceSha) { throw "Release checkout must remain at $ExpectedSourceSha." }
$approvalHash = Assert-ModelApproval

$account = Invoke-AzText account show --query '{id:id,state:state}' --output json | ConvertFrom-Json -AsHashtable
if ($account.id -ne $SubscriptionId -or $account.state -ne 'Enabled') { throw "Azure CLI must be signed in to enabled subscription $SubscriptionId." }
Invoke-Az account set --subscription $SubscriptionId

$groupExists = (Invoke-AzText group exists --name $ResourceGroup --output tsv) -eq 'true'
if ($groupExists) {
  $groupTags = Invoke-AzText group show --name $ResourceGroup --query tags --output json | ConvertFrom-Json -AsHashtable
  Assert-ResourceGroupOwnership $groupTags
}
if ($ReviewAfterUtc -le [DateTimeOffset]::UtcNow) { throw 'The student budget review date must be in the future.' }

$allLocalImages = @($BackendLocalImage, $AiBaseLocalImage, $WebLocalImage, $MigrationLocalImage, $DbInitLocalImage)
foreach ($image in $allLocalImages) { Assert-ImagePresent $image }

if (-not $FoundationOnly) {
  foreach ($path in @($BackendSecretsPath, $AiSecretsPath)) {
    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required secret input file not found: $path" }
  }
  $backendSecrets = Get-Content -LiteralPath $BackendSecretsPath -Raw | ConvertFrom-Json -AsHashtable
  $aiSecrets = Get-Content -LiteralPath $AiSecretsPath -Raw | ConvertFrom-Json -AsHashtable
  $requiredBackend = @('jwt-secret','client-jwt-secret','admin-jwt-secret','otp-hash-secret','email-otp-hash-secret','sender-hash-secret','ai-service-api-key','ai-campaigns-api-key','ai-models-api-key','ai-indicators-api-key','semaphore-api-key','gmail-smtp-user','gmail-smtp-app-password','stripe-secret-key','stripe-webhook-secret')
  $requiredAi = @('ai-service-api-key','ai-campaigns-api-key','ai-models-api-key')
  Assert-SecretObject $backendSecrets $requiredBackend
  Assert-SecretObject $aiSecrets $requiredAi
  if (-not ([string]$backendSecrets['stripe-secret-key']).StartsWith('sk_test_')) { throw 'The pilot requires a Stripe sk_test_ secret key.' }
  if (-not ([string]$backendSecrets['stripe-webhook-secret']).StartsWith('whsec_')) { throw 'The pilot requires a verified Stripe test webhook signing secret.' }
  foreach ($sharedName in @('ai-service-api-key','ai-campaigns-api-key','ai-models-api-key')) {
    if ([string]$backendSecrets[$sharedName] -cne [string]$aiSecrets[$sharedName]) { throw "Backend and AI '$sharedName' values must match." }
  }
} else {
  $backendSecrets = @{}
  $aiSecrets = @{}
}

if ($ValidateOnly) {
  [pscustomobject]@{
    validated = $true
    sourceSha = $ExpectedSourceSha
    approvalManifestSha256 = $approvalHash
    modelVersion = $ExpectedModelVersion
    resourceGroupExists = $groupExists
    reviewAfter = $ReviewAfterUtc.ToString('o')
    phase = $FoundationOnly ? 'foundation' : 'complete'
  }
  return
}

$adminPlain = ConvertFrom-SecureStringPlainText $PostgresAdminPassword
$appPlain = ConvertFrom-SecureStringPlainText $DatabaseAppPassword
try {
  if (-not $groupExists) {
    Invoke-Az group create --name $ResourceGroup --location $Location --tags application=bantai environment=student-test sourceSha=$ExpectedSourceSha managedBy=$ManagedBy resourcePrefix=$Prefix pilotOperator=$Operator reviewAfter=$($ReviewAfterUtc.ToString('o')) costCeilingUsd=25 --only-show-errors --output none
    $createdTags = Invoke-AzText group show --name $ResourceGroup --query tags --output json | ConvertFrom-Json -AsHashtable
    Assert-ResourceGroupOwnership $createdTags
  }


  $deploymentNames = @(Invoke-AzText deployment group list --resource-group $ResourceGroup --query '[].name' --output json | ConvertFrom-Json)
  $foundationExists = 'foundation' -in $deploymentNames
  if (-not $foundationExists) {

    $pendingImages = @{ backend='pending/backend'; ai='pending/ai'; web='pending/web'; migration='pending/migration'; dbInit='pending/db-init' }
    Write-ParameterFile -DeploySecrets $false -DeployJobs $false -DeployApps $false -BackendSecrets $backendSecrets -AiSecrets $aiSecrets -PostgresPassword $adminPlain -AppPassword $appPlain -Images $pendingImages -ReviewAfter $ReviewAfterUtc
    Invoke-Deployment 'foundation'
  } else {
    $foundationState = Invoke-AzText deployment group show --resource-group $ResourceGroup --name foundation --query properties.provisioningState --output tsv
    if ($foundationState -ne 'Succeeded') { throw "Existing foundation deployment is not successful: $foundationState" }
  }

  $acr = Invoke-AzText deployment group show --resource-group $ResourceGroup --name foundation --query properties.outputs.registryLoginServer.value --output tsv
  $defaultDomain = Invoke-AzText deployment group show --resource-group $ResourceGroup --name foundation --query properties.outputs.appsDefaultDomain.value --output tsv
  if ([string]::IsNullOrWhiteSpace($acr) -or [string]::IsNullOrWhiteSpace($defaultDomain)) { throw 'Foundation deployment did not return ACR and Container Apps domain outputs.' }
  $predictedBackendUrl = "https://$Prefix-backend.$defaultDomain"
  $predictedWebUrl = "https://$Prefix-web.$defaultDomain"

  if ($FoundationOnly) {
    [pscustomobject]@{
      phase = 'foundation'
      resourceGroup = $ResourceGroup
      predictedBackendUrl = $predictedBackendUrl
      stripeWebhookUrl = "$predictedBackendUrl/api/payments/webhook"
      predictedWebUrl = $predictedWebUrl
      reviewAfter = $ReviewAfterUtc.ToString('o')

      approvalManifestSha256 = $approvalHash
    }
    return
  }

  Invoke-Az acr login --name ($acr.Split('.')[0]) --only-show-errors --output none

  $aiReleaseLocal = 'bantai-ai:b5dd870-student-release'
  New-Item -ItemType Directory -Path $ApprovalContext | Out-Null
  Copy-Item -LiteralPath $ApprovalManifestPath -Destination (Join-Path $ApprovalContext 'model-approval.json')
  Invoke-Native docker @('buildx','build','--load','--file',(Join-Path $PSScriptRoot 'ai-release.Dockerfile'),'--build-arg',"BASE_IMAGE=$AiBaseLocalImage",'--build-context',"model=$ModelDirectory",'--build-context',"approval=$ApprovalContext",'--tag',$aiReleaseLocal,(Join-Path $PSScriptRoot '..\..'))

  $localImages = [ordered]@{ backend=$BackendLocalImage; ai=$aiReleaseLocal; web=$WebLocalImage; migration=$MigrationLocalImage; dbInit=$DbInitLocalImage }
  $remoteImages = @{}
  foreach ($entry in $localImages.GetEnumerator()) {

    $repoName = if ($entry.Key -eq 'dbInit') { 'bantai-db-init' } else { "bantai-$($entry.Key)" }
    $remote = "$acr/${repoName}:student-b5dd870"
    Invoke-Native docker @('tag', [string]$entry.Value, $remote)
    Publish-Image $remote

    $digest = Invoke-AzText acr repository show --name ($acr.Split('.')[0]) --image "$repoName`:student-b5dd870" --query digest --output tsv
    if (-not $digest.StartsWith('sha256:')) { throw "Unable to resolve immutable digest for $repoName." }
    $remoteImages[$entry.Key] = "$acr/$repoName@$digest"
  }

  Write-ParameterFile -DeploySecrets $false -DeployJobs $true -DeployApps $false -BackendSecrets $backendSecrets -AiSecrets $aiSecrets -PostgresPassword $adminPlain -AppPassword $appPlain -Images $remoteImages -ReviewAfter $ReviewAfterUtc
  Invoke-Deployment 'jobs'
  $migrationJob = Invoke-AzText deployment group show --resource-group $ResourceGroup --name jobs --query properties.outputs.migrationJobName.value --output tsv
  $dbInitJob = Invoke-AzText deployment group show --resource-group $ResourceGroup --name jobs --query properties.outputs.dbInitJobName.value --output tsv
  $migrationExecution = Invoke-AzText containerapp job start --resource-group $ResourceGroup --name $migrationJob --query name --output tsv
  Wait-Job $migrationJob $migrationExecution 1200

  $dbInitExecution = Invoke-AzText containerapp job start --resource-group $ResourceGroup --name $dbInitJob --query name --output tsv
  Wait-Job $dbInitJob $dbInitExecution 600

  Write-ParameterFile -DeploySecrets $true -DeployJobs $true -DeployApps $true -BackendSecrets $backendSecrets -AiSecrets $aiSecrets -PostgresPassword $adminPlain -AppPassword $appPlain -Images $remoteImages -ReviewAfter $ReviewAfterUtc
  Invoke-Deployment 'apps'
  $backendUrl = Invoke-AzText deployment group show --resource-group $ResourceGroup --name apps --query properties.outputs.backendUrl.value --output tsv
  $webUrl = Invoke-AzText deployment group show --resource-group $ResourceGroup --name apps --query properties.outputs.webUrl.value --output tsv
  if ((Invoke-WebRequest -UseBasicParsing -Uri "$backendUrl/api/health/ready" -TimeoutSec 240).StatusCode -ne 200) { throw 'Backend readiness check failed.' }
  if ((Invoke-WebRequest -UseBasicParsing -Uri "$webUrl/healthz" -TimeoutSec 240).StatusCode -ne 200) { throw 'Web readiness check failed.' }
  if ((Invoke-WebRequest -UseBasicParsing -Uri "$webUrl/api/health/ready" -TimeoutSec 240).StatusCode -ne 200) { throw 'Web-to-backend proxy readiness check failed.' }

  [pscustomobject]@{
    phase = 'complete'
    resourceGroup = $ResourceGroup
    backendUrl = $backendUrl
    webUrl = $webUrl
    reviewAfter = $ReviewAfterUtc.ToString('o')

    campaignMatching = [bool]$EnableCampaignMatching
    sourceSha = $ExpectedSourceSha
    approvalManifestSha256 = $approvalHash
  }
}
finally {
  $adminPlain = $null
  $appPlain = $null
  if (Test-Path -LiteralPath $TempParametersPath) { Remove-Item -LiteralPath $TempParametersPath -Force }
  $manifestCopy = Join-Path $ApprovalContext 'model-approval.json'
  if (Test-Path -LiteralPath $manifestCopy) { Remove-Item -LiteralPath $manifestCopy -Force }
  if (Test-Path -LiteralPath $ApprovalContext) { Remove-Item -LiteralPath $ApprovalContext -Force }
}
