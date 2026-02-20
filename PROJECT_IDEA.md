# Basement Lab — Project Idea

## Vision

A central **Hub** that unifies all LabTools apps (CinePrompt, POV, Chronos, Swag, Avatar) with login, shared history in the cloud, client projects, admin control, a shared toolbar, and a unified look. Everything runs on **Vercel**. Users can move outputs from one app into another (e.g. CinePrompt → POV → Chronos) and admins can see usage and manage teams.

---

## 1. Login and users in the database

- **Login**: Auth (e.g. NextAuth) with Credentials and/or OAuth (Google/GitHub). Session in JWT or DB.
- **Users in DB**: All users stored in the database. Admin can load/manage users (list, create, edit, deactivate). OAuth users can be created on first login; credential users created by admin.
- **Protection**: Hub routes (apps, admin, dashboard) require login; `/admin` restricted to admin role.

---

## 2. History (clean and easy to use) + Blob

- **Flow**: When an app produces a result (image/JSON), the hub receives it (from the iframe wrapper or via postMessage), uploads the file to **blob storage** (e.g. Vercel Blob), and saves metadata in the DB (userId, projectId, appId, blobUrl, timestamp, etc.).
- **History UI**: Clean, easy-to-use panel (in toolbar or dedicated page). Filter by app, project, date. Thumbnail + app name + date. Actions: “Open”, “Use in [app]” (sends the blob URL to the target app via postMessage).
- **Blob**: All generated assets stored in blob; DB only stores references (url + metadata).

---

## 3. Runs on Vercel

- Hub is a Next.js app deployed on Vercel.
- Apps can be deployed separately (e.g. static Vite builds on subdomains or under `/apps/*`) and loaded in iframes from the hub.
- Env on Vercel: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and API keys (e.g. Gemini) as needed.

---

## 4. Admin to control everything

- **Route**: `/admin` (admin role only).
- **Features**: User management (list, create, edit, deactivate), **project** (client) management, assign users to projects. Later: model management, internal messages.
- **Projects**: List of client projects (name, slug, client, active/inactive). Later: possibility to attach specific apps per project (upload apps per project to be refined later).

---

## 5. Client projects in the database

- **Tables**: `projects` (id, name, slug, clientName, isActive, …), `project_members` (userId, projectId, role?) so we know who sees which project.
- **Usage**: In the hub, a user only sees projects they’re assigned to (admins see all). History and dashboard are scoped by project. “Upload apps per project” is a later phase; the data model is ready for it.

---

## 6. Main apps and flow

| App        | Role |
|-----------|------|
| **CinePrompt** | Create images with a concrete style; several functions. |
| **POV**       | Change point of view of an image. |
| **Chronos**   | Change temporality of an image (e.g. “5 seconds before/after”). |
| **Swag**      | Logo placement and mockups; bulk-oriented. |
| **Avatar**    | Corporate avatar standardization; bulk. |

Flow idea: **CinePrompt → POV → Chronos**; Swag and Avatar are more specific bulk tools. The hub provides links to all apps in the toolbar and tags history by app so results can be sent to another app.

---

## 7. Toolbar and inter-app interaction

- **Toolbar** (shared, top or side): User (avatar + logout), **project** selector (if more than one), **history** (opens panel/drawer), **links to all apps**, **day/night mode**.
- **Using one app’s output in another**: Every “reference upload” or image input in every app should support:
  - **Upload** (current file input), or
  - **Pick from history** (hub opens history; user selects an item; hub sends that blob URL to the app via postMessage).
- **Implementation**: Each app gets a small adapter: listen for a postMessage (e.g. `SET_REFERENCE_IMAGE` with a URL); set the reference/input state (fetch to base64 if the app only accepts base64). Hub navigates to the target app and sends the message to the iframe. This can be refined later (e.g. “last CinePrompt result” shortcut for POV).

---

## 8. Model / engine switching

- Today each app has a hardcoded model (e.g. Gemini). When a model is busy or we want flexibility, users (and later admins) should be able to **switch model** or **add models** in a simple way.
- **Phase 1**: Hub has a `models` table and admin UI to list/add models (provider, modelId, default, active). Apps keep using their default until we wire them to the hub.
- **Phase 2**: Apps receive the chosen `modelId` from the hub (postMessage or URL param) and use it instead of the hardcoded one. Toolbar or settings can expose “Change model” for the user; admin can add new models.

---

## 9. Unified UI (light gray on black, minimal, monospace, no rounded corners)

- **Design system** (hub + toolbar): One set of tokens (CSS variables or Tailwind).
  - **Dark (default)**: Black background, light gray text (zinc scale), no rounded corners (`border-radius: 0`), monospace font (e.g. JetBrains Mono or Space Mono).
  - **Light**: Light gray background, dark text; same typography and no rounded corners.
- **Consistency**: Same button shapes, typography sizes, and patterns everywhere: hub, toolbar, and ideally all apps over time.
- **Day/night**: Toggle in the toolbar; persist in localStorage and apply theme to the shell (and optionally to iframe apps later).

---

## 10. Dashboard (usage, projects, messages, Linear & Slack)

- **Metrics**: Log interactions (e.g. `userId`, `projectId`, `appId`, `action`, `timestamp`) when saving to history or when apps notify the hub. Use for “which apps are used most per project”, “who is in which project”, “active projects”.
- **Dashboard** (`/dashboard`): Authenticated users (and optionally by role). Show:
  - Active projects.
  - Which apps are used most per project.
  - Who is in which project.
- **Internal messages** (soon): Table `messages` (from, to user or project, body, createdAt). Simple inbox + “send to user/project”. Badge in toolbar for new messages.
- **Linear and Slack** (next, but imminent):
  - **Linear**: Link to issues or “create issue from hub” (e.g. OAuth + API).
  - **Slack**: Webhook for notifications (e.g. “New CinePrompt result in project X”) or bot commands.

---

## Technical summary

| Area           | Choice |
|----------------|--------|
| Hub            | Next.js (App Router) in repo (e.g. `hub/` or `app/`), deploy on Vercel. |
| Apps           | Keep as separate Vite projects; load in iframe from hub; integrate via postMessage (history → “use in app”). |
| Database       | Vercel Postgres (or Supabase): users, projects, project_members, history, interactions, models, messages. |
| File storage   | Vercel Blob for outputs; DB stores only metadata + URL. |
| Auth           | NextAuth (Credentials and/or OAuth). |
| UI             | Single design system (gray on black, mono, no rounded); hub and toolbar first, apps aligned over time. |
| Apps per project | Not in first version; data model (projects) ready for it later. |

---

## Implementation order (suggested)

1. Hub base (Next.js, Vercel Postgres, env).
2. Auth (NextAuth, users table, protected routes).
3. Projects and members (tables + basic admin CRUD).
4. Blob + history (upload API, list history, “Use in [app]” in toolbar).
5. Toolbar (user, project, history, app links, day/night; design system).
6. Embed apps (iframe routes, postMessage for “set reference image”, adapters in each app).
7. Models (table + admin UI; optional postMessage to apps).
8. Dashboard (interactions, project/app usage, user–project list).
9. Internal messages (table + simple UI).
10. Linear + Slack (webhooks / OAuth as needed).

---

*This document is the single reference for the Basement Lab Hub idea and scope.*
