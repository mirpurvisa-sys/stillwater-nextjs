# Stillwater — Next.js for Vercel

This is the supplied Stillwater memorial-care application converted to standard **Next.js App Router + React + TypeScript**, using Node.js route handlers. There is no Vinext, Vite, Cloudflare Worker, D1, R2, or ChatGPT sign-in dependency.

The existing design, public pages, family portal, staff dashboard, role permissions, memorial privacy, moderation, scheduling, CSV/calendar/QR exports, enquiries and invoice tracking have been retained.

## 1. Deploy the website on Vercel

1. Extract this ZIP. The folder containing `package.json` is the project root.
2. Upload that folder's **contents** to a GitHub repository. A new repository is easiest. If reusing the old repository, replace its old project files rather than merging them: remove the old `worker/`, `scripts/`, `db/`, `drizzle/`, `.openai/`, `vite.config.ts`, `cloudflare-env.d.ts`, `drizzle.config.ts`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`. Keep the new `supabase/` directory and `package-lock.json`.
3. In Vercel, import the repository. Use these settings:

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Root Directory | Folder containing `package.json` (usually repository root) |
| Node.js | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Framework default; do not override |

`vercel.json` includes the build settings. Clear any old dashboard overrides for Vinext, pnpm or a custom output directory.

**The build and public design work without environment variables.** Without Supabase setup, private sign-in and saved form submissions are unavailable and the API returns a setup message. The app never pretends an unsaved form was received. This is a dynamic Next.js application: do not add `output: 'export'` or upload it as plain static HTML.

## 2. Enable sign-in, saved records and private files

Create one Supabase project. It supplies PostgreSQL, Authentication and Storage.

### A. Create the tables and private bucket

In Supabase, open **SQL Editor**, paste the entire contents of **`supabase/setup.sql`**, and run it once. It creates:

- A dedicated `stillwater` schema with records, member roles, grants, files and audit history.
- A **private** `stillwater-private` storage bucket.

Keep the `stillwater` schema out of your exposed Data API schemas. Browsers do not query these tables directly; Next.js checks permissions on the server. The SQL is safe to rerun for this initial setup; it does not delete existing rows. It is not a versioned schema migration system.

### B. Add these variables to Vercel

Open **Project → Settings → Environment Variables**. Add values for Production (and Preview if you want authenticated preview deployments):

| Variable | Value / where to find it |
|---|---|
| `SUPABASE_URL` | Supabase project URL from API settings |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role/secret API key; server only |
| `DATABASE_URL` | Supabase **Connect → Transaction pooler** PostgreSQL URI, normally port 6543 |
| `ADMIN_EMAIL` | Exact email of the owner account you will create below |
| `SUPABASE_STORAGE_BUCKET` | `stillwater-private` (optional; this is the default) |

Use the transaction pooler connection string, including its `postgres.PROJECT_REF` username, pooler hostname and your database password. URL-encode special characters in the password. Use the provider's TLS connection settings; do not disable certificate verification.

These variables are used only on the server. **Do not add `NEXT_PUBLIC_` to them, put credentials in GitHub, or expose the service-role key to visitors.** `.env.example` contains placeholders only.

Redeploy after adding or changing variables. No database is accessed during `next build`.

### C. Create your owner account

1. In Supabase **Authentication → Users**, create an email/password user for your own email. Confirm the account through the normal confirmation process, or use the dashboard's confirmation option for the owner account you control.
2. Set `ADMIN_EMAIL` to that same confirmed email, with no extra spaces.
3. Visit `https://YOUR-VERCEL-URL/signin`, enter the email/password, and sign in.
4. Open **Staff dashboard** from the website navigation/footer. On first login, only the explicitly configured owner email receives administrator access. The first public visitor is never made an admin.

There is no public self-registration screen. Use Supabase Authentication to create/confirm additional accounts and manage passwords. In the application's staff **Access** tab, assign the same email to coordinator, finance, family, or disabled. Assign families to an existing family case. Accounts without a grant cannot access the workspace. Keep general email confirmation enabled; only confirm addresses you control or have verified.

### D. Populate and use the application

Add your business settings, real service details, family cases and other records through the staff dashboard. Existing illustrative memorials remain sample content. Forms write to the database once setup is complete; they do **not** send email or SMS. Invoice status is tracked, but payment collection is not connected.

## Local development (Windows / PowerShell)

Install Node.js 22, then open PowerShell in this project folder:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Fill `.env.local` with your own Supabase values if you want to test live data locally. For a design-only preview, omit this file. Open the localhost URL printed by Next.js.

```powershell
npm run build
npm start
```

## Validation included

```powershell
npm run typecheck
npm test
npm run build
```

The API test suite executes the real route handlers and PostgreSQL query adapter against an isolated PGlite PostgreSQL engine. It checks CRUD, explicit owner bootstrap, grant requirements, case isolation, disabled sessions, role restrictions, publication consent, private/unlisted access, public field filtering, tribute moderation, RSVP validation, scheduling conflicts, rejected origins, private file access, oversized uploads, transactional rollback and auditing. The suite also checks sign-in, sign-out, unassigned accounts, unconfirmed accounts and setup-required responses. Auth server responses and private object storage are simulated in these tests; they do not validate your live Supabase credentials or Vercel account.

## What changed from the uploaded source

- Standard `next dev`, `next build`, `next start`, npm lockfile and Vercel configuration.
- Cloudflare D1 queries now use PostgreSQL through `pg`, with bound parameters and transactional batches.
- Private R2 uploads/downloads now use Supabase Storage behind the existing permission checks.
- ChatGPT identity headers/sign-in replaced by verified Supabase email/password sessions in HTTP-only cookies. No incoming identity header is trusted.
- Owner bootstrap now requires the configured `ADMIN_EMAIL`, rather than granting the first authenticated visitor administration.
- Disabled members lose access even with an existing session.
- **Uploads are limited to 4 MB per file** (previously 10 MB) to stay below Vercel's function request/response payload limit. JPG, PNG, WebP, PDF, MP3, WAV and MP4 remain supported. Larger media needs a separately implemented direct-upload flow; an external media link is also supported for tributes.
- Removed hosted-preview wording and platform-specific tooling. Public vs private memorial settings and family publication consent still apply.

## Important deployment limits

The source ZIP contains code, not existing Cloudflare D1 records, R2 files, or user accounts. No live data has been migrated. If you used the old backend, export and migrate its records/files separately before switching the live site.

Live database, authentication and storage still require your Supabase configuration. Only the local build and isolated backend tests have been verified; no changes have been made to your GitHub repository or Vercel project.

Before accepting real family records, replace illustrative material and business placeholders with approved content and complete the organisation's privacy, retention and contact information.

## Key files

- `app/memorial-app.tsx` — existing website, family portal and dashboard UI.
- `app/api/data/route.ts` — records, moderation, roles and submissions.
- `app/api/upload/route.ts` — private upload/download permission checks.
- `app/api/auth/route.ts`, `app/signin/`, `app/signout/` — email/password sessions.
- `lib/database.ts`, `lib/sql.ts` — PostgreSQL adapter.
- `lib/server.ts`, `lib/auth.ts`, `lib/access.ts` — verified identity and permissions.
- `lib/supabase.ts` — server-side auth/storage clients.
- `supabase/setup.sql`, `.env.example` — backend setup.

## Official references

- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/functions/limitations
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/storage/buckets/fundamentals
