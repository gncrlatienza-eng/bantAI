# BantAI — SMS Threat Intelligence

Android-based AI smishing detection system for Filipino mobile users.

## Project Structure

| Folder | Description |
|---|---|
| `mobile/` | Android app (Kotlin + Jetpack Compose) |
| `web/` | Web dashboard (React + Vite) |
| `backend/` | API server (NestJS + Prisma + PostgreSQL) |
| `ai/` | ML models, datasets, notebooks, scripts |
| `docs/` | Project documentation ([dev log](docs/development/DEV_LOG.md), [agile process](docs/development/AGILE_PROCESS.md), [API reference](docs/api/auth.md)) |

## Tech Stack

- **Mobile:** Kotlin, Jetpack Compose, DataStore
- **ML:** XLM-RoBERTa, HDBSCAN, SHAP
- **Backend:** NestJS, Prisma, PostgreSQL, JWT (phone-OTP auth)
- **Dashboard:** React, Vite, React Router

## Branching Strategy

- `main` — stable production
- `develop` — integration branch
- `feature/xxx` — new features
- `bugfix/xxx` — bug fixes

## Team

Built by Group 7 — DLSL CITE
