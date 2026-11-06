# BantAI Auth Architecture (target)

Status: plan. No code changes here. Reviewed and approved before we implement.

## Two surfaces, two flows

BantAI has two client applications with different device assumptions.

| Surface | Primary identifier | Second factor | SMS involved? |
|---|---|---|---|
| Mobile app | Phone number | SMS OTP (Abstract API) | Yes |
| Web (client + admin portals) | Email address | Google-provided OTP | No |

The web side never uses phone-based auth. The mobile side never uses email-based auth. This keeps the delivery channels aligned with the device the user is on (a mobile phone can receive SMS; a web browser cannot reliably).

## Data model changes

Prisma `User` model today:

```
User {
  id
  phone      unique, currently the auth identifier
  email      optional
  firstName
  lastName
  role       USER | ADMIN
}
```

Target:

```
User {
  id
  email               unique when set, primary web identifier
  emailVerifiedAt     timestamp, null until Google confirms
  phone               unique when set, primary mobile identifier
  phoneVerifiedAt     timestamp, null until SMS OTP confirms
  firstName
  lastName
  role                USER | ADMIN
}
```

Migration:
1. Drop the current NOT NULL / unique constraint on `phone` (make it nullable).
2. Add `email` unique index (partial unique, since email is nullable in the transition).
3. Add `emailVerifiedAt` and `phoneVerifiedAt` timestamps.
4. Backfill: existing rows keep their phone, `phoneVerifiedAt = createdAt`, email stays null until user sets it.

A user may have both phone (from mobile) and email (from web) attached to the same account. That is the point: it is one User with two possible entry channels. Linking flow is a follow-up (out of scope for the initial plan).

## Endpoints

Keep the existing phone-OTP endpoints, add three email-OTP endpoints.

```
POST /api/auth/request-otp        (existing)  phone -> SMS OTP via Abstract API
POST /api/auth/verify-otp         (existing)  phone + code -> JWT

POST /api/auth/email/start        (new)       email -> Google OTP delivery
POST /api/auth/email/verify       (new)       email + code -> JWT
POST /api/auth/email/register     (new)       first-time signup: email + name

POST /api/auth/admin/login        (new)       admin-only email + code -> JWT with ADMIN role check
```

The `/email/start` endpoint hands off to Google's OTP delivery. Two options:

- **Sign in with Google (OAuth 2.0):** Standard. User clicks "Sign in with Google", we receive an ID token, we treat the ID token verification as the OTP. Simpler, no code entry step.
- **Gmail SMTP OTP:** Send a 6-digit code from a Gmail account we control. Requires an app password. Less standard, more UX steps, but does not require enabling Google OAuth on the app.

Given your phrasing ("we want OTP from Google so email is required"), the OAuth flow is closer to what most users expect. I would recommend that path.

Admin login is the same email endpoint but the response layer enforces `role === 'ADMIN'`. If a non-admin verifies through `/admin/login`, the endpoint returns 403.

## Admin promotion

No more `ADMIN_PHONES` env var. Admin role is set directly on the User record. Two ways to bootstrap:

1. **DB seed** (`prisma/seed.ts`) that reads a small `admins.json` and upserts users with `role: 'ADMIN'` and their email.
2. **Migration + a one-off CLI script** (`npm run promote-admin -- --email x@y.com`) that flips the role.

Either is fine. Do NOT put the admin allowlist in the browser bundle.

## Frontend impact

- **Web LoginForm (`web/src/components/forms/LoginForm.tsx`):** Currently mocks localStorage + navigates to `/2fa`. Replace with a real "Continue with Google" button OR an email input + code step, depending on which Google path we choose.
- **Web AdminLogin (`web/src/pages/AdminLogin`):** Same treatment as the client login but wired to `/api/auth/admin/login` and rejecting non-admins.
- **Mobile app:** Unchanged. Continues to use `POST /api/auth/request-otp` and `POST /api/auth/verify-otp` with phone.
- **Client Overview and Admin Overview (already migrated):** No auth changes needed; they consume JWTs via the existing bearer scheme.

## Implementation phases

1. **Schema migration.** Add nullable email, verified timestamps. Backfill.
2. **Email OTP backend.** Add Google OAuth ID-token verifier (or Gmail SMTP sender). Add `/email/start`, `/email/verify`, `/email/register`. Reuse the JWT signing path.
3. **Admin login endpoint.** `/admin/login` with role enforcement.
4. **Admin bootstrap script.** Seed or CLI.
5. **Web login rewrite.** LoginForm + AdminLoginForm, replace mock with real API calls.
6. **Kill the /admin-login route.** Per the earlier IA plan, merge into `/login` with role detection based on the returned JWT.
7. **Deprecate the mocked 2FA route** (`/2fa` is unnecessary once real OTP verification lives inside the login flow).

## Open questions

1. **OAuth vs email code:** Which Google delivery mechanism? I recommend OAuth ID token.
2. **Do you have a Google Cloud project set up** for OAuth client credentials? If not, that is the very first step and it happens outside the codebase.
3. **What happens when a mobile-registered user (phone-only) tries to log into the web?** Options: reject and ask them to attach an email in the mobile app first, or send them a phone OTP to confirm ownership then let them attach an email inline. I lean toward the second.
4. **Are there existing admin users with phone numbers already in the DB?** If yes, the migration needs to preserve their role even after the phone-based promotion path goes away.
