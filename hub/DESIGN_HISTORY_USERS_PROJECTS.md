# Design: History, Users, Projects, Admin, Storage, Auth

## Overview

- **History**: View large, download, optional 4K upscale for small images; search; show app icon, date, user, project; filter by project.
- **Users**: Full name, nickname, avatar, email, password; assigned to one or more projects. Admin creates users.
- **Projects**: Name, client, thumbnail; links (web, Linear, Figma, Slack client, Slack internal); start/end dates; other links. Admin panel to create and assign.
- **Hub context**: Active user + active project. Every history save is tied to that project. History filterable by project.
- **Visibility**: Each user sees only their history, or (if permitted) history of everyone.
- **Storage**: Images → **Cloudflare R2**. Users, projects, assignments → **Neon** (PostgreSQL).
- **Auth**: Google login; default admin `lautaro@basement.studio`; long-lived session (no constant re-login); no email verification (intranet). Admin creates users.

---

## 1. Auth (NextAuth + Google + long session)

- **Provider**: Google OAuth (fast) + Credentials (optional fallback for admin).
- **Default admin**: `lautaro@basement.studio` — can be seeded in Supabase or allowed via Google if email matches.
- **Session**: JWT or database session with long `maxAge` (e.g. 30 days) and `updateAge` so the session is refreshed without logging out.
- **No verification**: Trust internal users; admin invites/creates users.

**Setup steps (you will do):**
1. In [Google Cloud Console](https://console.cloud.google.com/): create OAuth 2.0 Client ID (Web app), add authorized redirect URI `https://your-domain.com/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for dev).
2. In Hub `.env.local`: `GOOGLE_CLIENT_ID=...`, `GOOGLE_CLIENT_SECRET=...`, `NEXTAUTH_SECRET=...` (random string), `NEXTAUTH_URL=http://localhost:3000` (or your URL).
3. Optional: allow `lautaro@basement.studio` as admin by email in the Google provider `signIn` callback or in DB.

---

## 2. Data models

### Users (Supabase)

- `id` (uuid, PK)
- `email` (unique)
- `full_name`, `nickname`, `avatar_url`
- `password_hash` (nullable if only Google)
- `role`: `admin` | `member`
- `created_at`, `updated_at`

### Projects (Supabase)

- `id` (uuid, PK)
- `name`, `client`, `thumbnail_url`
- `links`: JSONB — `{ web?, linear?, figma?, slack_client?, slack_internal?, others? }`
- `start_date`, `end_date`
- `created_at`, `updated_at`

### Project members (Supabase)

- `project_id`, `user_id` (composite PK)
- `role` (optional)
- `created_at`

### Generations / History (Neon + R2)

- `id` (uuid, PK)
- `user_id` (FK)
- `project_id` (FK, nullable)
- `app_id` (e.g. `cineprompt`, `pov`)
- `image_url` (Cloudflare R2 URL — image stored in R2)
- `width`, `height` (for “small resolution” → show 4K upscale option)
- `name` (optional, user or auto)
- `created_at`

---

## 3. Storage

- **Images**: Upload data URL → convert to blob → upload to **Cloudflare R2**; store returned URL in `generations.image_url`. Download/upscale read from this URL.
- **Metadata**: Users, projects, project_members, generations table in **Neon** (PostgreSQL).

**Neon setup (you will do):**
1. Create project at [neon.tech](https://neon.tech).
2. In Hub `.env.local`: `DATABASE_URL=...` (connection string from Neon).
3. Run `hub/supabase/neon_setup.sql` in Neon SQL editor.

**R2 setup (you will do):**
1. Cloudflare Dashboard → R2 → Create bucket; create API token with read/write.
2. In Hub `.env.local`: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

---

## 4. History page behavior

- **List**: Thumbnails with app icon, date, user name, project name; search by name/app/user/project.
- **Actions per item**: View in large (lightbox/modal), Download, “Upscale to 4K” (only if `width` or `height` &lt; threshold, e.g. 1920).
- **Filter**: By project (dropdown when we have active project / project list).
- **Visibility**: “My history” vs “All” (admin or permission).

---

## 5. Admin layer

- **Routes**: e.g. `/admin` (overview), `/admin/users`, `/admin/projects`. Protected by `role === 'admin'`.
- **Users**: List (avatar, name, email, projects); create user (email, name, nickname, assign projects); invite via Google or set password.
- **Projects**: List (name, client, thumbnail, dates); create/edit (name, client, thumbnail, links, dates); assign users.

---

## 6. Hub context (active user + project)

- **Provider**: e.g. `HubContext` with `user`, `project`, `setProject`. Session gives `user`; project selected in toolbar or dropdown.
- **On “Download and add to history”**: Save image to R2, insert row in `generations` with `user_id`, `project_id` (current project), `app_id`, `image_url`, dimensions.
- **History**: Filter by `project_id` when a project is selected; optionally “All projects”.

---

## 7. Implementation order

1. **History UI (current store)**: View large (lightbox), download, 4K upscale button when resolution &lt; 1920 (for now downloads same file; wire to real upscale API later), search, app icon + date. Done in `HistoryClient.tsx` and `appIcons.tsx`.
2. **Auth**: NextAuth + Google + long session; default admin email; protect `/admin` and optional `/history` by session.
3. **Supabase schema**: Create tables; add client and server helpers; migrate “add to history” to write to Supabase + Blob.
4. **Admin**: List users, list projects; create/edit projects; create users and assign to projects.
5. **Hub context**: Active project in toolbar; save generation with `project_id`; history filter by project.
6. **Visibility**: “My history” vs “All” based on role or permission.

---

## 8. Setup guides (you run these)

### Google OAuth (for login)

1. Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth 2.0 Client ID (Web application).
2. Authorized redirect URIs: http://localhost:3000/api/auth/callback/google (and your production URL).
3. In Hub .env.local: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET (random), NEXTAUTH_URL.

### Neon

1. neon.tech -> New project -> copy connection string.
2. Hub .env.local: DATABASE_URL.
3. In Neon SQL Editor run hub/supabase/neon_setup.sql.

### Cloudflare R2 (images)

1. Cloudflare Dashboard -> R2 -> Create bucket; create API token with read/write.
2. Hub .env.local: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL.
3. API routes use @/lib/r2 to upload and store URL in generations.image_url.
