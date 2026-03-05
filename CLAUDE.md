# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Basement Lab is a monorepo of AI-powered creative apps unified under a Next.js dashboard called the **Hub**.

- **`hub/`** — Next.js 14 app (the main dashboard/shell). Handles auth (NextAuth), history (Supabase + Vercel Blob), and renders each app in an iframe.
- **App folders** (`cineprompt`, `chronos`, `swag`, `avatar`, `render`, `frame-variator`, `nanobanana`, etc.) — Independent Vite + React + TypeScript apps. Each builds into `hub/public/embed/<slug>/` and is served as a static iframe.
- **`apps-common/`** — Shared CSS (`global.css`) imported by all app entry files.
- **`projects/`** — Project-specific apps (e.g., `projects/Native/connect`).
- **Root `App.tsx` / `index.html`** — Legacy AI Studio scaffold; not the active app.

### Hub internals

- `hub/lib/bridgeTypes.ts` — postMessage contract between Hub and embedded apps.
- `hub/lib/appUrls.ts` — Maps slugs to their embed URL or `NEXT_PUBLIC_APP_<SLUG>_URL` override.
- `hub/app/apps/[slug]/AppFrameClient.tsx` — Contains `VALID_SLUGS`; validates and opens app tabs.
- `hub/components/Toolbar.tsx` — Contains `APP_LINKS` (toolbar icons per app).
- `hub/app/HomeAppsSection.tsx` — Home page app grid.

### Hub ↔ App communication

Apps communicate with the Hub via `postMessage`. Types are defined in `hub/lib/bridgeTypes.ts`. Each app has a `lib/hubBridge.ts` that wraps `isHubEnv()`, `openReferencePicker()`, and `openDownloadAction()`. Use any existing `hubBridge.ts` as the copy template.

## Commands

### Hub (Next.js)
```bash
# Run dev server (from hub/)
npm run dev --prefix hub

# Build
npm run build --prefix hub

# Lint
npm run lint --prefix hub

# Set admin password (requires hub/.env.local configured)
cd hub && node scripts/set-password.js <email> <password>
```

### Individual apps (Vite)
```bash
# Dev server for a single app
npm run dev --prefix <slug>          # e.g. npm run dev --prefix nanobanana

# Build a single app (outputs to hub/public/embed/<slug>/)
npm run build --prefix <slug>
```

### Build all apps
```bash
# From repo root
npm run build:apps
```

## Environment Variables

**Root `.env.local`** (shared by all Vite apps via `vite.config.ts`):
```
GEMINI_API_KEY=...
```

**`hub/.env.local`** (Hub only):
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
SETUP_PASSWORD_SECRET=...
BLOB_READ_WRITE_TOKEN=...
```

## Adding a New App

Full guide in `ADD_NEW_APP.md`. Summary of required touch-points:

1. App folder at repo root; folder name = slug.
2. `import '../apps-common/global.css'` in the app entry file.
3. Copy `lib/hubBridge.ts` from an existing app (e.g., `render`).
4. `vite.config.ts`: set `base: '/embed/<slug>/'`, `build.outDir: '../hub/public/embed/<slug>'`, load env from root + app dir, inject `process.env.GEMINI_API_KEY`.
5. Hub registrations (four places):
   - `hub/lib/appUrls.ts` — add slug to `BUILT_EMBED_SLUGS`
   - `hub/app/apps/[slug]/AppFrameClient.tsx` — add to `VALID_SLUGS` and `APP_LABELS`
   - `hub/components/Toolbar.tsx` — add to `APP_LINKS`
   - `hub/app/HomeAppsSection.tsx` (or `page.tsx`) — add to the `APPS` array
6. Root `package.json` `build:apps` script — append `&& npm run build --prefix <slug>`.

## Database Setup (Supabase)

Run in order against your Supabase project:
1. `hub/supabase/schema.sql`
2. `hub/supabase/migrations/001_add_tags_to_generations.sql`
3. `hub/supabase/migrations/002_add_icon_to_submitted_apps.sql`
4. `hub/supabase/seed.sql` (creates admin user)

## Deployment (Vercel)

- Set **Root Directory** to `hub` in Vercel project settings.
- Embed apps must either be pre-built and committed under `hub/public/embed/`, or built on Vercel with a custom build command: `cd .. && npm run build:apps && cd hub && npm run build`.
- All `hub/.env.local` variables must be added to Vercel's Environment Variables, with `NEXTAUTH_URL` set to the production URL.
