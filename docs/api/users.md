# Users API Reference

Base URL (local development): `http://localhost:3000/api`

All endpoints here require the JWT described in [auth](auth.md), sent as `Authorization: Bearer <token>`.

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
  "lastName": "Dela Cruz"
}
```

Constraints: `firstName`/`lastName` max 50 chars. Unknown fields are rejected (400).

The sign-in email **cannot** be changed here — a body containing `email` is rejected with `400`. This route used to accept it, which let any valid session re-point the account's login identity to another inbox without re-authentication or verifying the new inbox (security audit AUTH-02, 2026-10-13). Changing a login email will need its own verified flow.

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

- `400` — validation failed, including any attempt to send `email`.
- `401` — missing/invalid/expired token.
