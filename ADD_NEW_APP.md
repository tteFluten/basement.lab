# Add a new app to Basement Lab

Short guide to add a new app (from a folder or from scratch) so it has: **shared styles**, **upload/download + history** (Hub modals), **toolbar icon**, and **API key**.

---

## 1. Put the app in the project root

- Create or copy your app folder next to `cineprompt`, `pov`, etc.  
- Example: `e:\basement.lab\my-app\`
- The folder name = **slug** (use lowercase, hyphens ok, e.g. `my-app`).

---

## 2. Shared styles (one CSS for all)

**In your app’s entry file** (e.g. `index.tsx` or `main.tsx`), add at the top:

```ts
import '../apps-common/global.css';
```

**In `index.html`:** remove any `<style>` block (font, body, scrollbar). Leave only a comment:

```html
<!-- Base styles: apps-common/global.css (imported from index.tsx) -->
```

Optional: use palette variables in your components (`#0a0a0a` background, `#333` borders, `text-zinc-400`, etc.).

---

## 3. Hub bridge (upload + history, download + history)

**Create** `my-app/lib/hubBridge.ts` and copy the contents from `pov/lib/hubBridge.ts` (or `render/lib/hubBridge.ts`). Do not change the message names (`BASEMENT_OPEN_REFERENCE_PICKER`, etc.).

**In your app:**

- **Upload / “pick reference”:**  
  Where you currently use a file input for an image, add something like:

  ```ts
  import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';

  const handlePickImage = () => {
    if (isHubEnv()) {
      openReferencePicker().then((dataUrl) => {
        // set your state with dataUrl, e.g. setImage(dataUrl)
      }).catch(() => {});
    } else {
      document.getElementById('my-file-input')?.click();
    }
  };
  ```

  Keep a hidden `<input type="file" id="my-file-input" ... />` for when the app runs **outside** the Hub.

- **Download:**  
  Where you download an image (e.g. result), use:

  ```ts
  const handleDownload = async (imageDataUrl: string) => {
    if (isHubEnv()) {
      try {
        await openDownloadAction(imageDataUrl, 'my-app');  // slug as appId
      } catch {
        // fallback: trigger normal download
      }
    } else {
      // normal <a download> or link.click()
    }
  };
  ```

  If the image is a blob URL, convert to data URL first (e.g. `fetch(url).then(r=>r.blob()).then(blob=>...FileReader...readAsDataURL`).

---

## 4. Vite config (build into Hub + API key)

In `my-app/vite.config.ts` (create one like in `pov` or `render`):

- Set **base** to `/embed/<slug>/` (e.g. `base: '/embed/my-app/'`).
- Set **build.outDir** to `../hub/public/embed/<slug>` (e.g. `path.resolve(__dirname, '../hub/public/embed/my-app')`).
- Load env from **root and app folder** so `GEMINI_API_KEY` works from the project root:

  ```ts
  const rootDir = path.resolve(__dirname, '..');
  const rootEnv = loadEnv(mode, rootDir, '');
  const appEnv = loadEnv(mode, __dirname, '');
  const env = { ...rootEnv, ...appEnv };
  ```

- In **define**:

  ```ts
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.API_KEY ?? ''),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.API_KEY ?? ''),
  },
  ```

Use a different **port** for `server.port` if you run dev (e.g. 5178 for the new app).

---

## 5. Hub: slug, toolbar icon, home link

**A) Valid slug and iframe**

- Open `hub/app/apps/[slug]/AppFrameClient.tsx`.
- In `VALID_SLUGS`, add your slug as a new string, e.g. `"my-app"`.

**B) Toolbar icon**

- Open `hub/components/Toolbar.tsx`.
- Import an icon from `lucide-react` (e.g. `Sparkles`).
- In `APP_LINKS`, add: `{ slug: "my-app", label: "My App", Icon: Sparkles }`.

**C) Home page link**

- Open `hub/app/page.tsx`.
- Import the same icon.
- In the `APPS` array, add: `{ slug: "my-app", label: "My App", desc: "Short description", Icon: Sparkles }`.

---

## 6. Build script

- Open the **root** `package.json` (at `e:\basement.lab\package.json`).
- In the `build:apps` script, append: `&& npm run build --prefix my-app` (use your real slug as folder name).

---

## 7. API key (Gemini)

- In the project **root**, or inside `my-app/`, create or edit `.env.local` with:

  ```
  GEMINI_API_KEY=your_gemini_api_key_here
  ```

- In your app code, use `process.env.API_KEY` or `process.env.GEMINI_API_KEY` when creating the Gemini client (the Vite define above injects it at build time).

---

## 8. Build and run

From the project root:

```powershell
npm run build --prefix my-app
```

Or build everything:

```powershell
npm run build:apps
```

Then start the Hub (e.g. `npm run dev --prefix hub` or your `start-hub.cmd`). Your app will be at **http://localhost:3000/apps/my-app** with:

- Shared styles from `apps-common/global.css`
- Upload / pick from history via the Hub modal
- Download / “download and add to history” via the Hub modal
- Icon in the toolbar and link on the home page

---

## Checklist

| Step | What |
|------|------|
| 1 | App folder at root, slug = folder name |
| 2 | `import '../apps-common/global.css'` in entry; remove inline styles from `index.html` |
| 3 | `lib/hubBridge.ts` copied; upload uses `openReferencePicker()`, download uses `openDownloadAction(dataUrl, slug)` when `isHubEnv()` |
| 4 | `vite.config.ts`: base `/embed/<slug>/`, outDir `../hub/public/embed/<slug>`, env from root+app, define API key |
| 5 | Hub: add slug to `VALID_SLUGS`, add to `APP_LINKS` and `APPS` with icon |
| 6 | Root `package.json`: add `&& npm run build --prefix <slug>` to `build:apps` |
| 7 | `GEMINI_API_KEY` in `.env.local` (root or app folder) |
| 8 | Run `npm run build --prefix my-app` (or `build:apps`) and open Hub |
