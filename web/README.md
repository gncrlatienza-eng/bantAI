# BantAI Web Dashboard

Admin/client dashboard UI for the **BantAI** anti-smishing system, built with **React**,
**TypeScript**, and **Vite**.

**Current state: hardcoded mock data (`src/mocks/referenceData.ts`) — not yet wired to the
backend.** Every page renders, but nothing here calls the NestJS API yet.

---

## Tech Stack

- React 19, TypeScript, Vite 7
- React Router
- No test framework configured yet

---

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
```

---

## Project Structure

```
src/
├── pages/           public/, admin.tsx, client.tsx (the three big dashboard pages)
├── components/      shared UI (charts, common, dashboard, forms, layout, navigation)
├── routes/          AppRoutes.tsx, ProtectedRoute.tsx
├── context/          UserAvatarContext.tsx
├── hooks/            useClickOutside, useTimer, useScrollReveal
├── mocks/            referenceData.ts — the mock data every page currently reads from
└── types/            auth.ts, common.ts, licensing.ts, threat.ts
```

---

## Code Quality & Security

```bash
npm run lint            # ESLint (typescript-eslint + React rules + Prettier plugin)
npm run format           # Prettier --write
npm run format:check     # Prettier, check-only (what CI runs)
npm audit                # dependency vulnerability scan
```

Config: `eslint.config.js`, `.prettierrc`, `.prettierignore`. Deliberately scoped down in
`admin.tsx`/`client.tsx`/`public.tsx` — `no-unsafe-*`, `no-misused-promises`, and
`no-unescaped-entities` are turned off for those three files specifically. Root cause:
`src/mocks/referenceData.ts` has no TypeScript interfaces, so anything destructured from it is
`any`; typing that file properly would resolve nearly all of it at once, but that's a real
follow-up task, not something to mass-edit blind across ~15,000 lines. See the comment block in
`eslint.config.js` for the full reasoning.

---

## Authors

BS Computer Science Thesis Project, De La Salle Lipa
