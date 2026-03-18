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
public/
  manifest.webmanifest
  sw.js
```

## Setup
1. Copy `.env.example` -> `.env.local`
2. Fill Supabase environment values
3. Run SQL in `supabase/schema.sql`
4. Create `documents` storage bucket in Supabase (or keep SQL bucket section)
5. Run:
   - `npm install`
   - `npm run dev`

## Validation Commands
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Deployment
- Ready for Vercel
- Ensure all environment variables are configured in project settings
