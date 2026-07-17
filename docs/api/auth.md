# Auth API Reference

Base URL (local development): `http://localhost:3000/api`

Authentication is phone-based OTP. There are no passwords. A successful OTP verification returns a JWT which must be sent as `Authorization: Bearer <token>` on protected endpoints.

- **JWT expiry:** 7 days by default (`JWT_EXPIRES_IN`).
- **Secret:** `JWT_SECRET` env var (falls back to a hardcoded dev secret — must be set in production).
- **OTP delivery (dev):** codes are NOT sent by SMS yet; they are printed to the backend console: `OTP for <phone>: <code>`. OTPs are 6 digits and expire after 5 minutes.
- **Validation:** requests are validated with a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`) — unknown body fields cause a 400.

---

## POST /auth/register

Explicitly register a user with profile details. Optional — `verify-otp` auto-creates a bare user for unknown phone numbers, so this is only needed when collecting profile info up front.

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

- `201` — `{ "message": "User registered successfully.", "user": { ... } }`
- `400` — phone already registered.

---

## POST /auth/request-otp

Generate an OTP for a phone number. Works for both existing and new numbers.

**Request**

```json
{ "phone": "+639170000001" }
```

**Responses**

- `201` — `{ "message": "OTP generated successfully." }` (read the code from the backend console in dev)

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
  "access_token": "<jwt>",
  "user": {
    "id": "5892f7b5-91f3-4c4e-a52a-6d0ad693ae13",
    "phone": "+639170000001",
    "email": null,
    "firstName": null,
    "lastName": null,
    "createdAt": "2026-07-17T14:17:11.235Z",
    "updatedAt": "2026-07-17T14:17:11.235Z"
  }
}
```

- `404` — invalid OTP (wrong code, or already used).
- `400` — OTP expired.

**JWT payload:** `{ "sub": "<userId>", "phone": "<phone>" }`.

---

## GET /auth/me  🔒

Returns the authenticated user. Use this on app load to validate a stored token.

**Request**

```
Authorization: Bearer <access_token>
```

**Responses**

- `200` — the user object (same shape as in `verify-otp`).
- `401` — missing/invalid/expired token.
- `404` — token valid but user no longer exists.

---

## Frontend login flow

1. User enters phone → `POST /auth/request-otp`.
2. User enters the 6-digit code → `POST /auth/verify-otp`.
3. Store `access_token` (e.g. localStorage for the dashboard, DataStore on Android).
4. Attach `Authorization: Bearer <token>` to all subsequent API calls.
5. On app start, call `GET /auth/me` — a `401` means the token is stale; clear it and return to login.
