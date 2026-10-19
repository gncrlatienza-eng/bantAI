# Landing page captures

Real BantAI portal UI, captured on **synthetic data only** from
`web/src/pages/Landing/landingDemo.json`. Each media file has a `.txt` sidecar
holding the text that was on screen; `tools/landing-capture/verify-assets.mjs`
checks those for real names, emails, phone numbers, production hosts, and
non-`.example` lure domains, and fails closed when a sidecar is missing.

| File                                         | Source                                                              | Captured                          |
| -------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `hiw-connect.webp`                           | Admin portal → Campaigns → campaign detail (`/admin/campaigns/:id`) | 2026-10-15, Chromium 1440×900 @2x |
| `ps-portal-loop.{webm,mp4}` + `-poster.webp` | Campaigns list → click campaign → scroll its masked messages (9 s)  | 2026-10-15, Chromium 1440×900     |

Android app captures were planned but skipped (2026-10-15): the capture
machine did not have disk space for an emulator. Phone visuals on the landing
page remain illustrative SVG mockups built from the same demo data.

## Regenerate

```powershell
# 1. Disposable database (never a real one — the server refuses other names)
docker exec bantai-postgres-1 psql -U bantai -d postgres -c "CREATE DATABASE bantai_shield_landing_1;"
cd backend; npm run build
$env:DATABASE_URL = "postgresql://bantai:bantai_dev@localhost:5434/bantai_shield_landing_1"
npx prisma migrate deploy --schema database/prisma/schema.prisma
node scripts/serve-landing-demo.mjs          # API on 127.0.0.1:3101

# 2. Portal pointed at the demo API (web/.env.landingdemo)
cd web; npx vite --mode landingdemo --host 127.0.0.1 --port 5175 --strictPort

# 3. Capture, encode, gate
npm run landing:capture
npm run landing:encode
npm run landing:verify-assets

# 4. Drop the disposable database afterwards
docker exec bantai-postgres-1 psql -U bantai -d postgres -c "DROP DATABASE bantai_shield_landing_1 WITH (FORCE);"
```
