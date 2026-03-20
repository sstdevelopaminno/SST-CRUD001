# SST Backoffice (Next.js 14 + Supabase)

Enterprise-grade SaaS backoffice for **SST INNOVATION CO., LTD.** with bilingual UX (English + Thai), RBAC, IT control panel, full audit logging, and PWA support.

## Stack
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- ShadCN-style UI components
- Supabase (Auth, PostgreSQL, Storage)

## Features
- Supabase Auth (email/password)
- Session-aware middleware
- RBAC: `CEO`, `MANAGER`, `HEAD`, `STAFF`, `IT`
- IT Panel: feature flags, API config, health widgets, module control
- Modules: Dashboard, CRM, Projects, Jobs, Billing, Documents, Approvals, Admin
- Multi-level approvals with CEO override path
- Document upload + signature capture
- Audit logging for page visits, clicks, approvals, document events, data actions
- Import/Export (CSV/JSON)
- PWA (`manifest.webmanifest`, `sw.js`)

## i18n
- Localized routes: `/{locale}/...`
- Supported locales: `en`, `th`
- Middleware locale fallback -> `/en`

## Project Structure
```text
src/
  app/
    [locale]/
      (auth)/login
      (protected)/
        dashboard
        crm
        projects
        jobs
        billing
        documents
        approvals
        admin
        it-panel
    actions/
  components/
    layout/
    ui/
    dashboard/
    documents/
    it-panel/
    shared/
  hooks/
  lib/
    auth/
    constants/
    i18n/
    supabase/
  services/
  types/
supabase/
  schema.sql
ocr-server/
  server.js
  package.json
public/
  manifest.webmanifest
  sw.js
```

## Setup
1. Copy `.env.example` -> `.env.local`
2. Fill required environment values
   - Supabase:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - OCR service integration:
     - `OCR_SERVICE_URL` (required when scan mode enabled)
     - `OCR_SERVICE_API_KEY` (optional)
     - `OCR_SERVICE_API_KEY_HEADER` (optional, default uses `Authorization: Bearer <key>`)
     - `OCR_SERVICE_TIMEOUT_MS` (optional, default `20000`)
     - `NEXT_PUBLIC_OCR_ENABLED` (`true` to enable scan UI, `false` for manual-only mode)
3. Run SQL in `supabase/schema.sql`
4. Create `documents` storage bucket in Supabase (or keep SQL bucket section)
5. Run:
   - `npm install`
   - `npm run dev`
   - Open `http://127.0.0.1:3000/en/login` (preferred on Windows if `localhost` fails)
   - If port conflict, run `npm run dev:reset`

## Quick Start OCR Server (Example)
1. `cd ocr-server`
2. `npm install`
3. copy `.env.example` -> `.env`
4. `npm run start`
5. In root `.env.local`, set:
   - `OCR_SERVICE_URL=http://127.0.0.1:8000/ocr/id-card`
   - `NEXT_PUBLIC_OCR_ENABLED=true`

If OCR is not ready yet, set `NEXT_PUBLIC_OCR_ENABLED=false` to use manual identity entry mode.

## OCR Service Contract
`POST ${OCR_SERVICE_URL}` with `multipart/form-data`
- Required field: `id_card_front` (image file)
- Optional field: `id_card_back` (image file)

Response should be JSON and can be either direct fields or wrapped (e.g. `{ data: { ... } }`).
Recognized fields include:
- `full_name` / `fullName`
- `id_card_number` / `idCardNumber`
- `id_card_address` / `idCardAddress`
- Optional: `raw_text_front`, `raw_text_back`, `confidence`

## Validation Commands
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run verify:supabase` (checks required tables and RLS health via `schema_healthcheck` RPC)
- `npm run dev:oneclick` (one-click: stop port 3000 process + clear `.next` + start dev + open Edge at `127.0.0.1`)

## Deployment (Vercel + OCR Server)
- Deploy this app on Vercel
- Configure all env vars from `.env.example` in Vercel Project Settings
- `OCR_SERVICE_URL` must point to your external OCR server endpoint (reachable from Vercel)
- Frontend auto-optimizes ID card image size before upload to reduce request-size failures
