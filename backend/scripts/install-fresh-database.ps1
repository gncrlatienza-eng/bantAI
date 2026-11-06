param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$previousDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = $DatabaseUrl
$schema = Join-Path $PSScriptRoot '..\database\prisma\schema.prisma'
$verification = Join-Path $PSScriptRoot 'verify-otp-replay.sql'
$migration = '20260923010000_restore_semaphore_otp'
$prismaCli = Join-Path $PSScriptRoot '..\node_modules\prisma\build\index.js'

try {
  Push-Location (Join-Path $PSScriptRoot '..')
  try {
    & node.exe $prismaCli migrate deploy --schema $schema
    if ($LASTEXITCODE -eq 0) { return }

    # This recovery is only for a fresh install where the prior migration
    # already made OtpCode. The SQL aborts if the schema is unexpected.
    & node.exe $prismaCli db execute --schema $schema --file $verification
    if ($LASTEXITCODE -ne 0) {
      throw 'Fresh-install OTP schema verification failed; migration history was not changed.'
    }
    & node.exe $prismaCli migrate resolve --rolled-back $migration --schema $schema
    if ($LASTEXITCODE -ne 0) { throw 'Could not mark the failed OTP replay as rolled back.' }
    & node.exe $prismaCli migrate resolve --applied $migration --schema $schema
    if ($LASTEXITCODE -ne 0) { throw 'Could not record the redundant OTP replay as applied.' }
    & node.exe $prismaCli migrate deploy --schema $schema
    if ($LASTEXITCODE -ne 0) { throw 'Remaining migrations failed.' }
  } finally {
    Pop-Location
  }
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
}
