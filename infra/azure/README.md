# Azure student deployment

The active deployment is `student.bicep` with `deploy-student.ps1`, following [the October–December student plan](../../docs/deployment/STUDENT_ALWAYS_AVAILABLE_PLAN_2026-10-05.md). Web, backend and internal AI use zero minimum replicas and one maximum replica; requests and opaque-ID queue work wake them. PostgreSQL remains private and persistent. The daily outbox repair job recovers unpublished work. There is no fixed session shutdown; the December review date is a budget checkpoint.

Build the student backend runtime and migration build target from `backend/Dockerfile`, the web image from `infra/web/Dockerfile`, and the AI base from `ai/Dockerfile`. The completion script packages the six hash-pinned approved model files privately, resolves immutable registry digests, runs migrations and database role initialization, then deploys the applications. Populated secret files stay outside the repository. Test Stripe keys and the verified test webhook secret are required.

The $24 monthly budget and alerts are billing controls, not a hard spending cap. The plan depends on the account's PostgreSQL, Standard ACR and Standard Load Balancer grants and bounded test usage. Verify posted billing and actual replica hours after provisioning.

## Superseded temporary pilot

The following instructions document the earlier bounded pilot. They do not apply to the active student deployment. Do not run its stop supervisor against the student environment.

This directory prepares PR #112 (`b5dd8707f55d27314e1ed780ab619448d435f063`) for a bounded Azure Container Apps pilot. It does not make the current uncommitted release fixes part of Git history.

## Ordered release

1. Review the clean-worktree diff and the exact six-file Model-C operator approval manifest. The script rejects a wrong manifest hash, an artifact hash mismatch, extra files/directories, and reparse points before creating the foundation.
2. Choose a two-hour or four-hour session. `deploy-pilot.ps1` records Reymark as the operator, calculates and tags an exact UTC expiry, and requires at least 45 minutes remaining before foundation work.
3. Run with `-FoundationOnly`. Before creating the private network, PostgreSQL, Standard ACR, vaults, split managed identities, logs, and Container Apps environment, the script starts a hidden local stop supervisor and waits for its exact resource-group/expiry acknowledgement. The foundation output includes the future backend URL and Stripe test webhook URL.
4. Register that URL in Stripe test mode, obtain its verified `whsec_`, generate separate high-entropy client/admin JWT secrets in the private backend JSON, then rerun without `-FoundationOnly`. Live Stripe keys and placeholder inputs are rejected.
5. The completion phase builds the private Model-C layer from external contexts, pushes all images, resolves immutable ACR digests, and deploys only the two manual jobs first.
6. It runs all Prisma migrations first, then creates/rotates the restricted `bantai_app` role with a separate libpq-compatible bootstrap URL. Application containers are created only after both jobs succeed.
7. The final phase deploys internal AI plus public backend/web, with one active revision, AI held at one warm replica for the bounded session, backend/web capped at one replica, TLS ingress, vault references, and readiness checks.
8. At the tagged expiry, the supervisor invokes `stop-pilot.ps1` without bypassing the resource-group expiry. The stop script deletes only the exact owned apps/jobs/environment and stops the exact owned PostgreSQL server. It refuses unexpected or mismatched resources and preserves database data, VNet/DNS, vaults, ACR artifacts, identities, and logs for review/restore.

Campaign matching defaults off because the approved six-file Model-C bundle does not contain `campaign_space.json`, and the fresh database has no approved centroids. Classification remains enabled. Enabling campaigns requires both artifacts and a new reviewed approval manifest with updated deployment hash pins.

## Cost boundary

The subscription policy denies the original Southeast Asia target, so the validated target is East Asia. East Asia supports Container Apps, PostgreSQL 16/B1ms, and Standard ACR, with one unused managed-environment quota. Its current Consumption rates put the configured backend, AI, and web requests at about $6.91 for 24 active hours after an otherwise-unused monthly grant. The working subtotal is $11.89 after bounded load balancer/public-IP time, twelve daily log caps and retention, the DNS zone plus one million queries, short jobs, vault operations, and an egress allowance; adding the required $10 contingency yields $21.89. This stays below the authorized $25 ceiling only while the verified Azure for Students PostgreSQL B1ms/storage/backup and Standard ACR grants apply; Standard ACR retail price alone remains about $20.66 for 31 days. Abort if either grant is not credited. Log Analytics is capped at 0.1 GB/day with 30-day retention; Azure notes that ingestion can continue briefly after a daily cap is reached. The stop script preserves resources that can continue to accrue storage, registry, DNS, vault-operation, and log charges, so billing must be checked after the first short session. Keep the managed environment lifetime within the same bounded pilot window even when application replicas are at zero. This forecast does not cover an environment retained all month.

## Examples

```powershell
$pgAdmin = Read-Host 'PostgreSQL admin password' -AsSecureString
$appDb = Read-Host 'bantai_app password' -AsSecureString
./deploy-pilot.ps1 -DurationHours 2 `
  -PostgresAdminPassword $pgAdmin -DatabaseAppPassword $appDb `
  -ModelDirectory C:\private\model-c `
  -ApprovalManifestPath C:\private\model-approval.json `
  -FoundationOnly

# Configure the returned Stripe test webhook URL, place its whsec_ value and
# separate client/admin JWT secrets in the private JSON files, then resume.
./deploy-pilot.ps1 -DurationHours 2 `
  -BackendSecretsPath C:\private\backend-secrets.json `
  -AiSecretsPath C:\private\ai-secrets.json `
  -PostgresAdminPassword $pgAdmin -DatabaseAppPassword $appDb `
  -ModelDirectory C:\private\model-c `
  -ApprovalManifestPath C:\private\model-approval.json

./stop-pilot.ps1
```

Use the isolated Azure CLI configuration for this release. Never place populated secret JSON, Model-C weights, or the approval manifest inside the repository.
