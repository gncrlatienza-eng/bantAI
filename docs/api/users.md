# Users API Reference

Base URL (local development): `http://localhost:3000/api`

All endpoints here require the JWT from [auth](auth.md) `verify-otp`, sent as `Authorization: Bearer <token>`.

---

## PUT /users/me  🔒

Update the authenticated user's profile. Fields are optional — omitted fields are left unchanged. The Android app calls this from the onboarding Profile screen so the `User` row carries the person's name, not just their phone number.

**Request**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "email": "user@example.com"
}
```

Constraints: `firstName`/`lastName` max 50 chars; `email` must be a valid email. Unknown fields are rejected (400).

**Responses**

- `200` — the updated user object:

```json
{
  "id": "5892f7b5-91f3-4c4e-a52a-6d0ad693ae13",
  "phone": "+639170000001",
  "email": null,
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "createdAt": "2026-07-17T14:17:11.235Z",
  "updatedAt": "2026-07-17T15:36:44.410Z"
}
```

- `401` — missing/invalid/expired token.
