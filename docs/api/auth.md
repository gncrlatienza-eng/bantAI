# Auth API Reference

Base URL (local development): `http://localhost:3000/api`

Android uses phone-based OTP delivered through Semaphore. Web portal users use a separate email/password flow. Both flows return a bantAI JWT for protected endpoints.

- **JWT expiry:** 7 days by default (`JWT_EXPIRES_IN`).
- **JWT secret:** `JWT_SECRET` is required at startup.
- **OTP delivery:** `SEMAPHORE_API_KEY` and `OTP_HASH_SECRET` are required. Delivery failures return 503 and invalidate the pending code. OTPs are stored as hashes, never printed or recoverable from the database.
- **Validation:** requests are validated with a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`) — unknown body fields cause a 400.

---

## POST /auth/register

Validates a Philippine phone number and directs the caller to verify ownership. It does not create a user or store profile fields before verification.

**Request**

```json
{
  "phone": "+639170000001",
  "email": "user@example.com",
  "firstName": "Juan",
  "lastName": "Dela Cruz"
}
```

`email`, `firstName`, `lastName` are optional.

**Responses**

- `201` — `{ "message": "Verify this phone number before creating a profile." }`
- `400` — invalid Philippine mobile number.

---

## POST /auth/request-otp

Generate an OTP for a phone number. Works for both existing and new numbers.

**Request**

```json
{ "phone": "+639170000001" }
```

**Responses**

- `201` — `{ "message": "OTP generated successfully." }`
- `429` — request limit reached.
- `503` — SMS delivery failed; the pending code is invalidated.

---

## POST /auth/verify-otp

Verify the OTP. On success: marks the code used, creates the user if the phone is new, and returns a JWT.

**Request**

```json
{ "phone": "+639170000001", "otp": "974983" }
```

**Responses**

- `201` —

```json
{
  "message": "Authentication successful.",
  "access_token": "<jwt>"
}
```

No `user` object is returned here by design — the auth payload deliberately carries no PII (see `auth.service.spec.ts`). Callers that already know the phone number they just verified don't need it back; call `GET /auth/me` if you need the full profile.

- `400` — invalid or expired OTP (the two cases are deliberately not distinguished, so a guessed code can't be told apart from an expired one).

**JWT payload:** `{ "sub": "<userId>", "role": "USER" }`. An existing administrator keeps their stored role.

---

## GET /auth/me  🔒

Returns the authenticated user. Use this on app load to validate a stored token.

**Request**

```
Authorization: Bearer <access_token>
```

**Responses**

- `200` — the current database user profile.
- `401` — missing/invalid/expired token.
- `404` — token valid but user no longer exists.

---

## Web portal authentication

`POST /auth/portal/register` accepts `email`, `password` (8–128 characters), and optional `company`. `POST /auth/login` accepts `email` and `password`. Both return a JWT; administrator status comes from the stored user role.

## Android login flow

1. User enters phone → `POST /auth/request-otp`.
2. User enters the 6-digit code → `POST /auth/verify-otp`.
3. Store `access_token` in the Android app's user preferences.
4. Attach `Authorization: Bearer <token>` to all subsequent API calls.
5. On app start, call `GET /auth/me` — a `401` means the token is stale; clear it and return to login.
