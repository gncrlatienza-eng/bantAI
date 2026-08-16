# bantAI Backend

Backend API for the **bantAI** Anti-Smishing Detection System.

Built with **NestJS**, **Prisma ORM**, and **PostgreSQL**.

---

## Tech Stack

- NestJS
- Prisma ORM
- PostgreSQL
- Docker
- TypeScript
- Passport + JWT (phone-OTP authentication)

---

## Project Structure

```
src/
├── auth/        # phone-OTP auth, JWT issuance, guards
├── users/       # profile endpoints (PUT /users/me)
├── sms/
├── ai/
├── analytics/
├── campaigns/
├── reports/
├── health/
└── main.ts

database/
├── prisma/
│   ├── schema.prisma    # User, OtpCode, SmsMessage, Classification, Alert
│   └── migrations/
├── prisma.module.ts
└── prisma.service.ts
```

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Start PostgreSQL

From the **repo root** (the compose file lives there, not in `backend/`):

```bash
docker compose up -d postgres
```

Postgres listens on host port **5433** (mapped to 5432 in the container) with user `bantai` / db `bantai_db`. pgAdmin is available via `docker compose up -d pgadmin` at `http://localhost:5050`.

### Run database migrations

```bash
npx prisma migrate dev --schema database/prisma/schema.prisma
```

### Generate Prisma Client

```bash
npx prisma generate --schema database/prisma/schema.prisma
```

### Start the development server

```bash
npm run start:dev
```

The API will be available at:

```
http://localhost:3000/api
```

---

## Code Quality & Security

```bash
npm run lint            # ESLint (typescript-eslint + Prettier plugin), auto-fixes what it can
npm run format           # Prettier --write
npx prettier --check .   # Prettier, check-only (what CI runs)
npm audit                # dependency vulnerability scan
```

Config: `eslint.config.mjs`, `.prettierrc`. Type-checked rules (`no-unsafe-*`, `unbound-method`)
are relaxed for `*.spec.ts`/`test/**` — mocked objects are inherently loosely-typed, so those
rules fire on the mock, not on a real bug. Two spots keep a scoped, commented
`eslint-disable` rather than a workaround: `ai.service.ts`'s `res.json()` (the Fetch API itself
types this `Promise<any>`) and `auth.module.ts`'s JWT `expiresIn` cast (works around
`jsonwebtoken`'s branded `StringValue` type).

Run `npx prisma generate --schema database/prisma/schema.prisma` before linting after pulling
schema changes — a stale generated client produces a wall of false "unsafe access" errors that
have nothing to do with your code.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` (Prisma also reads `backend/database/.env` for the schema CLI):

```env
DATABASE_URL="postgresql://bantai:bantai_dev@localhost:5433/bantai_db"
SHADOW_DATABASE_URL="postgresql://bantai:bantai_dev@localhost:5433/bantai_shadow_db"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="7d"
```

`JWT_SECRET` falls back to a hardcoded dev value — it must be set in production.

---

## Current Features

### Backend Foundation
- ✅ NestJS project setup
- ✅ PostgreSQL with Docker
- ✅ Prisma ORM integration
- ✅ Health endpoint
- ✅ Global validation (`whitelist` + `forbidNonWhitelisted`)
- ✅ CORS configuration

### Authentication (phone OTP — no passwords)
- ✅ OTP request + verification (`OtpCode` model, 6 digits, 5-minute expiry)
- ✅ JWT issued on successful verification (Passport JWT strategy + guard)
- ✅ Auto-creates a user on first OTP verification for unknown numbers
- ✅ Protected `GET /auth/me` for token validation
- ⚠️ Dev-only OTP delivery: codes are printed to the backend console (`OTP for <phone>: <code>`), not sent by SMS yet

### Users
- ✅ JWT-guarded `PUT /users/me` profile update (firstName / lastName / email) — used by the Android onboarding Profile screen

---

## API Endpoints

Full request/response documentation: [docs/api/auth.md](../docs/api/auth.md) and [docs/api/users.md](../docs/api/users.md).

### Health

```
GET /api/health
```

### Authentication

```
POST /api/auth/register      (optional — verify-otp auto-registers)
POST /api/auth/request-otp
POST /api/auth/verify-otp    → returns JWT
GET  /api/auth/me            🔒 Bearer token
```

### Users

```
PUT /api/users/me            🔒 Bearer token
```

---

## Development Workflow

Branch strategy:

```
main
│
develop
│
feature/<feature-name>
│
bugfix/<bug-name>
```

---

## Authors
BS Computer Science Thesis Project
De La Salle Lipa
