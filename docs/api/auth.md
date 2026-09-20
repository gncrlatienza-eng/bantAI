# Auth API Reference

Base URL (local development): `http://localhost:3000/api`

bantAI has two intentionally separate authentication flows:

- Android users prove ownership of a Philippine mobile number with Firebase Phone Authentication.
- Web clients and administrators sign in with email and password.

Every successful flow returns a bantAI JWT for protected API requests. Send it as `Authorization: Bearer <token>`.

## Android mobile authentication

Firebase generates, sends, expires, and verifies the SMS code in the Android app. The app then exchanges the resulting Firebase ID token for a bantAI JWT. The backend never receives or stores the OTP.

### POST /auth/mobile/firebase

```json
{ "idToken": "<firebase-id-token>" }
```

The backend verifies the token signature, audience, expiry, phone number, and Firebase sign-in provider. It then creates or retrieves the phone-owned user without changing an existing role.

**Responses**

- `200` — `{ "message": "Authentication successful.", "access_token": "<bantai-jwt>" }`
- `401` — invalid, expired, or non-phone Firebase token
- `503` — `FIREBASE_PROJECT_ID` is not configured

Firebase development test numbers and codes must be configured in Firebase Console. Never add a production bypass or log real OTP values.

## Web portal authentication

### POST /auth/portal/register

```json
{
  "email": "user@example.com",
  "password": "a-long-password",
  "company": "Optional Company"
}
```

### POST /auth/login

```json
{
  "email": "user@example.com",
  "password": "a-long-password"
}
```

Both endpoints return the normal bantAI JWT. Administrator status comes from the stored database role, never from a client-supplied field.

## GET /auth/me

Returns the authenticated user's current database record.

```text
Authorization: Bearer <bantai-jwt>
```

- `200` — current user
- `401` — missing, invalid, or expired JWT
- `404` — the user no longer exists

## Mobile flow

1. Android calls Firebase Phone Authentication with the normalized `+63...` number.
2. Firebase sends and verifies the six-digit SMS code.
3. Android obtains a Firebase ID token.
4. Android sends the ID token to `POST /auth/mobile/firebase`.
5. The backend verifies it and returns the bantAI JWT.
6. Android stores only the bantAI JWT for subsequent API calls.
