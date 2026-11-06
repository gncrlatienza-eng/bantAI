# Southeast Asia Azure pilot cost gate — conditional estimate

Status: **priced scenario, not a deployed service or a guaranteed charge cap.** User ceiling is **under $25/month**. Checked 2026-09-28. The Azure for Students subscription `ebaf0ea0-102e-4e89-a445-fc4c4fd9c5da` showed $0 current cost and no application resources. Its live 12-month free-services panel showed unused PostgreSQL Flexible Server B1ms compute (0/750 hours), storage (0/32 GB-month), backup storage (0/32 GB-month), and Standard Container Registry (0/31 registry-days), expiring 2027-09-22. The $24 monthly budget sends email alerts at 80% and 100%; **alerts do not stop resources or impose a $24 limit**.

## Bounded compute scenario

Run one public HTTPS NestJS Container App at **0.5 vCPU/1 GiB** and one environment-internal FastAPI Model-C Container App at **4 vCPU/8 GiB**, each for **at most 24 combined hours in a calendar month**. Include deployments, model warm-up, health checks, tests, and overlapping revisions in those hours. One active revision and maximum one replica each. The AI must actually fit and finish within the backend deadline; these sizes are candidates, not benchmark results. Android offline inference remains independent of cloud availability.

Microsoft Southeast Asia Retail Prices API rates observed 2026-09-28: **$0.000034 per active vCPU-second** and **$0.000004 per active GiB-second** for Container Apps Consumption. For 24 hours, AI gross compute is $14.5152 and backend gross compute is $1.8144. The shared monthly grant of 180,000 vCPU-seconds and 360,000 GiB-seconds subtracts $7.56 if unused by other apps. **Estimated apps compute: $8.7696.** The live student panel lists a Standard ACR allowance and B1ms PostgreSQL allowances at zero usage; treat those as **$0 only while the exact meters remain eligible and within limit**. If Standard ACR eligibility fails, paid Basic at about $0.1666/day for 31 days adds ~$5.16. PostgreSQL without its free grant is a material cost and requires repricing before creation.

The $8.77 compute subtotal does **not** include private DNS, VNet-related charges, image/model storage beyond registry allowances, database overages, Key Vault, log storage, bandwidth beyond grants, OTP/Semaphore/email delivery, tax, or Azure price changes. Retain at least **$10 contingency** and require a region/SKU-specific all-in estimate below **$20** before provisioning. Do not substitute a broad-public-access PostgreSQL firewall or disable authentication merely to meet this price. Azure documents that custom VNet use can incur additional charges. A secure private PostgreSQL path must be designed and priced separately.

## Runtime control

- Pilot means scheduled UAT windows, **not 24/7 availability**. Choose the actual dates with the team; no schedule has been authorized or created. Each session must have a named operator and an explicit stop time.
- Start backend and AI only for sessions, verify `/api/health/ready` and AI `/ready`, then stop both Container Apps after the session and verify zero running replicas. `minReplicas=0` alone still permits traffic-triggered restart. Count all billable time, including startup and deployment overlap.
- The free B1ms PostgreSQL server can remain within its 750-hour monthly allowance if eligible. If that allowance is not applied, the pilot must be shortened and the database stopped/charged hours verified; do not rely on unattended stop indefinitely.
- Inspect actual Azure cost and free-meter consumption after the first short smoke session before scheduling the next. Budget evaluation can lag. If the estimate, quota, or credit balance cannot be verified, do not activate billable resources.

## Remaining pre-provisioning checks

1. Confirm remaining usable student credit/spending-limit state and Southeast Asia quota for at least 4.5 Consumption vCPUs, plus PostgreSQL B1ms and Standard ACR availability.
2. Price **private VNet integration and Private DNS** with the selected topology; reject a public database with broad Azure-wide firewall access.
3. Obtain the Model-C production approval packet and device evidence in `MODEL_C_APPROVAL_PACKET.md`; do not bypass fail-closed readiness.
4. Build immutable images from reviewed committed source, not the current dirty checkout. Run one-time Prisma migration on a clean PostgreSQL 16 database, then smoke-test both services and auth/OTP without logging SMS content.
5. Rehearse start, stop, rollback, and the first session's metered spend. Maintain the $24 Azure alert budget but never call it a hard cap.

Sources: [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing), [Container Apps workload sizes](https://learn.microsoft.com/en-us/azure/container-apps/workload-profiles-overview), [Azure for Students allowances](https://azure.microsoft.com/en-us/free/students/), [PostgreSQL private networking](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private), [Azure budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).
