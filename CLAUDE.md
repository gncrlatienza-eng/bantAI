# bantAI — Claude Context

## What This Project Is

bantAI is a thesis project: an SMS smishing/scam detection system for Filipino mobile users. It intercepts SMS messages on Android, classifies them using an ML model, and surfaces alerts through a mobile UI and admin web dashboard.

**GitHub:** https://github.com/gncrlatienza-eng/bantAI

**Team:**
- Gio (`gncrlatienza-eng`) — Mobile
- Maxene — AI/ML
- Reymark De Castro — Backend, git management
- Daryl De Castro — Web

---

## Monorepo Structure

```
bantAI/
├── mobile/       Android app (Kotlin + Jetpack Compose)
├── backend/      NestJS REST API
├── web/          React + Vite admin/client dashboard
├── ai/           Python ML notebooks and trained models (NOT part of backend)
└── docs/         API docs, dev logs, agile process records
```

---

## Stack

| Layer | Tech |
|---|---|
| Mobile | Android, Kotlin, Jetpack Compose |
| Backend | NestJS 11, Prisma ORM, PostgreSQL 16 |
| Web | React 18, Vite, TypeScript, react-router-dom |
| Auth | OTP via phone number → JWT (NO passwords) |
| Database | PostgreSQL 16 — Docker port `5434:5432` |
| AI/ML | Python, Jupyter notebooks (separate from backend) |

---

## Backend

- **Port:** `3000`
- **API prefix:** `/api` (all routes are `/api/...`)
- **Start dev:** `cd backend && npm run start:dev`
- **DB migrations:** `cd backend && npx prisma migrate dev`

### Auth Flow (OTP only — NO password login)

```
POST /api/auth/register       — create account with phone number
POST /api/auth/request-otp   — send OTP to phone
POST /api/auth/verify-otp    — verify OTP, returns JWT
GET  /api/auth/me            — JWT-guarded, returns current user
PUT  /api/users/me           — JWT-guarded, update profile
```

**The User model has no password field.** `bcrypt` is in dependencies but is currently unused (leftover from an earlier iteration that was replaced by OTP).

### Data Models (Prisma)

- `User` — phone (unique), email, firstName, lastName
- `OtpCode` — phone, code, expiresAt, verified
- `SmsMessage` — userId, sender, body, receivedAt
- `Classification` — messageId, label (Likely Smishing | Suspicious | Unknown), score
- `Alert` — messageId, status (Pending | Blocked | Reported | Ignored)

### Docker (local dev DB)

```bash
docker compose up -d   # starts postgres:5434 and pgadmin:5050
```

pgAdmin: `http://localhost:5050` — admin@bantai.dev / admin

**Port note:** Docker uses `5434:5432` (not 5432 or 5433) because Reymark's Windows machine has native Postgres installations on both 5432 and 5433 that conflict.

### Backend `.env` required vars

```
DATABASE_URL=postgresql://bantai:bantai_dev@localhost:5434/bantai_db
SHADOW_DATABASE_URL=postgresql://bantai:bantai_dev@localhost:5434/bantai_shadow
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```

---

## Mobile (Android)

Located in `mobile/`. Key packages under `com.bantai`:

- `receiver/` — `SmsReceiver.kt` intercepts incoming SMS, `WapPushReceiver.kt`
- `data/remote/AuthApi.kt` — Retrofit API client for backend auth
- `data/local/UserPreferences.kt` — stores JWT and user state
- `ui/screens/onboarding/` — OTP registration flow
- `ui/screens/main/` — Home, Messages, Alerts, Campaigns
- `viewmodel/` — OnboardingViewModel, MessagesViewModel

---

## Web Dashboard

Located in `web/`. React + Vite + TypeScript.

**Current state: hardcoded mock data — NOT connected to the backend.**

Routes: public view, client view, admin view (`/admin`).

---

## AI / ML

Located in `ai/`. This is **pure Python ML work — it is NOT integrated into the NestJS backend yet.**

```
ai/
├── datasets/   raw/, processed/, labeled/
├── models/     trained model files
├── notebooks/  Jupyter notebooks for training/evaluation
├── scripts/    helper scripts
└── evaluation/
```

The backend has stub controllers for `ai`, `analytics`, `campaigns`, `reports`, `sms` — these are **empty placeholders**, not implemented.

---

## Branching Strategy

```
main        ← stable production only
develop     ← integration branch (all PRs merge here first)
feature/xxx ← new features (branch from develop, PR back to develop, delete after merge)
bugfix/xxx  ← bug fixes (branch from develop, PR back to develop, delete after merge)
```

**Never** push directly to `develop`. **Never** merge `main` into `develop`.

---

## WBS Tracking (Automated)

The live WBS is at `docs/development/WBS.md`. It is the single source of truth for sprint progress.

### Important — Claude contributor rule

**Never run `git commit` in this project.** Edit files freely, but leave all commits to the team. Do not add `Co-Authored-By: Claude` to any message. If git operations are needed (branch management, merges, pushes), those are fine — just no commits that would put Claude in the author history.

### Rules — follow these every session without being asked

1. **When you complete any task** (write code, merge a branch, finish a doc), immediately open `docs/development/WBS.md` and change the matching item's checkbox:
   - `[ ]` Not Started → `[-]` In Progress (when work begins)
   - `[-]` In Progress → `[x]` Complete (when the deliverable is done and merged/committed)
   - Also update the **parent item** if all its children are now complete.

2. **When the user tells you something is done**, mark it complete in the WBS right away — do not wait until the end of the conversation.

3. **When starting a new conversation**, read `docs/development/WBS.md` to understand current sprint progress before doing anything else.

4. **Mapping guide — what maps to which WBS item:**

   | What got done | WBS item |
   |---|---|
   | Prisma schema change / migration | Check 1.3.4 or sprint-relevant schema task |
   | New NestJS endpoint | Match to the endpoint's sprint Build task |
   | New Prisma table | Match to the table's sprint Build task |
   | New Android screen | Match screen name in sprint Build tasks |
   | ML notebook / model | Match to AI/ML Build task in current sprint |
   | New web dashboard page | Match to Web Dashboard Build task |
   | PR merged to develop | Mark that feature's Build task complete |
   | Branch merged to main | No extra WBS action needed |
   | Sprint demo done | Mark the Sprint Review task (x.5.x) complete |

5. **When a parent task's children are all `[x]`**, mark the parent `[x]` too. Example: when 2.3.1–2.3.11 are all done, mark 2.3 and then 2 complete.

6. **Never mark something `[x]` if the code isn't committed.** In-progress local work = `[-]`.

7. **Also update DEV_LOG.md** — every time a WBS item is marked `[x]`, add a matching row to the Progress Log table in `docs/development/DEV_LOG.md`:

   | Column | What to write |
   |---|---|
   | Date | Today's date (YYYY-MM-DD) |
   | Module | Backend / Android / Dashboard / ML / Docs / All |
   | What was done | One sentence: what was built and what it enables |
   | Done by | The team member who did the work (ask if unsure) |

   Do NOT commit these file edits — leave all commits to the team.

---

## Known Hallucination Traps

These are things Claude commonly gets wrong about this project — verified against the actual code:

1. **No password auth.** There is no `password` field anywhere in the schema or codebase. Auth is OTP → JWT only. A `login` endpoint does NOT exist.

2. **AI is not in the backend.** The `ai/` folder is Python/ML. The NestJS `backend/src/ai/` is an empty stub. Do not assume AI classification runs inside NestJS.

3. **Web is not connected to backend.** The React dashboard uses `src/mocks/referenceData.ts` — it has no live API calls yet.

4. **Backend stubs are empty.** `ai`, `analytics`, `campaigns`, `reports`, `sms` controllers/services in the backend exist as files but have no implementation.

5. **bcrypt is installed but unused.** It was from an earlier password-based iteration that was replaced. Do not suggest using it for user auth.

6. **Database port is 5433, not 5432.** Docker maps `5433→5432` to avoid conflicts with local Postgres installs.
