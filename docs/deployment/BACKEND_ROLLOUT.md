# Backend production rollout checklist

This is the Track A checklist for WBS 6.2.3 and 6.3.2. It is provider-neutral:
build the image from the repository root, push it to the selected registry, and
run it on a platform that can reach PostgreSQL and the AI service privately.

## Before deployment

- [ ] Select the hosting platform, region, image registry, and production URL.
- [ ] Provision PostgreSQL 16 with TLS, backups, point-in-time recovery, and a
      least-privilege application role.
- [ ] Provision or deploy the AI service on a private network reachable through
      `AI_SERVICE_URL`.
- [ ] Create distinct production secrets in the platform secret manager; never
      place them in GitHub variables, an APK, or a web bundle:
      `DATABASE_URL`, `JWT_SECRET`, `OTP_HASH_SECRET`, `SENDER_HASH_SECRET`,
      `ADMIN_PHONES`, `AI_CAMPAIGNS_API_KEY`, `AI_MODELS_API_KEY`,
      `AI_INDICATORS_API_KEY`, and `SEMAPHORE_API_KEY`.
- [ ] Set `CORS_ORIGINS` to the exact deployed dashboard origins. Wildcards are
      not permitted.
- [ ] Keep `API_DOCS_ENABLED=false` externally. If documentation is needed,
      expose it only through an authenticated internal gateway.
- [ ] Set `TRUST_PROXY_HOPS` to the exact proxy count supplied by the host; use
      `0` when there is no trusted reverse proxy.
- [ ] Obtain a production Semaphore account and verify the sender/OTP delivery
      policy. The backend fails closed when delivery is unavailable.

## Build and release

From the repository root, after a reviewed commit is checked out:

```bash
docker build -f backend/Dockerfile -t bantai-backend:<release-tag> .
docker run --rm --env-file backend/.env.production bantai-backend:<release-tag>
```

The second command is a configuration smoke test. It must fail if any required
secret is missing. Do not use it against production until the database URL
points to the intended production database.

Before routing traffic, run migrations once from a trusted release runner:

```bash
cd backend
npm ci
npx prisma migrate deploy --schema database/prisma/schema.prisma
```

Use a network-restricted runner and the same `DATABASE_URL` as the deployment.
Do not run `prisma migrate dev` in production.

## Release verification

- [ ] Image builds from a clean checkout with `docker build`.
- [ ] `npm run build`, `npm test`, `npx prettier --check .`, and
      `npm audit --audit-level=high` pass in the release environment.
- [ ] Database migrations complete successfully and are recorded by Prisma.
- [ ] `GET /api/health` returns 200 after process start.
- [ ] `GET /api/health/ready` returns 200 only after PostgreSQL is reachable.
- [ ] An Android device and deployed dashboard can complete OTP login against
      the production URL.
- [ ] A test SMS is ingested, classified by the private AI service, and appears
      only in the owning user's account.
- [ ] Verify rate-limit behavior, audit logs, backup restoration, and alerting.

## Rollback

1. Stop routing new traffic to the failed release.
2. Restore the previously verified image tag.
3. Roll database schema changes forward where possible; do not delete live data
   as a rollback shortcut.
4. For a model problem, use the authenticated model rollback route rather than
   changing files inside a running container.
5. Record the incident, release tag, migration state, and validation result.

## Secure admin credential issuance

Admin access is issued by phone ownership, not by a reusable browser API key.

1. Obtain the administrator's canonical Philippine mobile number through a
   separate verified channel.
2. Add it to the `ADMIN_PHONES` secret in the platform secret manager.
3. Redeploy or restart the backend so the secret is loaded.
4. The administrator completes normal OTP verification; the backend issues a
   role-bearing JWT with `ADMIN` access.
5. Confirm an administrator-only endpoint succeeds and a regular user receives
   HTTP 403.
6. To revoke access, remove the number from `ADMIN_PHONES`, restart the service,
   and invalidate the user's active sessions by rotating `JWT_SECRET` if an
   immediate global logout is required.

Never manually edit database roles as a credential-issuance mechanism, never
share a JWT between administrators, and never include `ADMIN_PHONES` or any AI
service key in client-side configuration.
