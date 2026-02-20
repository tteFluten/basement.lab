# Deploy to Vercel (Hub / Dashboard)

If you see "render" and a black screen, Vercel is building the **root** of the repo (which has an old Vite app) instead of the **Hub** (Next.js dashboard).

## Fix: set Root Directory to `hub`

1. Open your project on [vercel.com](https://vercel.com).
2. Go to **Settings** → **General**.
3. Under **Root Directory**, click **Edit** and set it to **`hub`**.
4. Save and trigger a **Redeploy** (Deployments → … → Redeploy).

After that, Vercel will build and run the Next.js Hub from the `hub` folder and you’ll see the dashboard instead of a black screen.

---

## Optional: build the embed apps (iframes) on deploy

The Hub loads apps from `hub/public/embed/<app>/` (e.g. cineprompt, pov, render). By default those folders are only filled when you run `npm run build:apps` from the repo root **locally**.

- **Option A – Build locally and commit:** Run `npm run build:apps` on your machine, then commit the `hub/public/embed/` folder. Deploys will then have the apps without extra build steps.
- **Option B – Build on Vercel:** In Vercel, set **Root Directory** to `hub` and **Build Command** to:
  ```bash
  cd .. && npm run build:apps && cd hub && npm run build
  ```
  Ensure the root `package.json` has the `build:apps` script and that each app has its dependencies (e.g. run `npm install` in each app folder or use a single install step before `build:apps` if you add one).

---

## Env vars on Vercel

In **Settings** → **Environment Variables**, add any keys the Hub or apps need (e.g. `GEMINI_API_KEY` if you use it server-side). For the embed apps, the key is usually baked in at build time when you run `build:apps` with `.env.local` set.
