# Basement Lab

Toolset of AI-powered creative apps (React + Vite + Gemini). Each app runs as a standalone project.

## Apps

| App | Description |
|-----|-------------|
| **CinePrompt** | Cinematic video prompt generator: structured JSON for AI video models, with visual selectors for camera, lens, and movement. |
| **POV** | 4K conceptualization suite. Grids, variation selection, and ultra-HD refinement with Gemini. |
| **Chronos** | Time-shift tool: reverse or advance an image by 5 seconds for video keyframes. |
| **Swag** | Logo placement and mockup generator. Swag, merch, and environmental mockups up to 4K. |
| **Avatar** | Corporate avatar standardization: bulk upload + one reference image to apply consistent style and framing. |

## Run locally

**Prerequisites:** Node.js

Each app is independent. From the project root:

```bash
cd cineprompt   # or pov, chronos, swag, avatar
npm install
```

Create `.env.local` in that folder and set your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

Then:

```bash
npm run dev
```

Repeat for any other app you want to run.

## Structure

```
basement.lab/
├── hub/         # Next.js Hub (auth, history, toolbar, admin) — run from hub/
├── avatar/      # Avatar style standardization
├── chronos/     # Time-shift for keyframes
├── cineprompt/  # Cinematic prompt generator
├── pov/         # POV / concept art
├── swag/        # Logo mockups
├── PROJECT_IDEA.md
└── README.md
```

## Hub (Basement Lab) — unified

The Hub uses **Geist Mono** and a shared toolbar. **All apps are built into the Hub** and served from a single process (no separate dev servers).

**From repo root:**

1. **First time (or after changing app code):** build apps into the hub:
   ```powershell
   npm run build:apps
   ```
2. **Start the Hub:**
   ```powershell
   npm run dev
   ```
   Or double-click `start-hub.cmd` (it runs `build:apps` automatically if needed).

Open [http://localhost:3000](http://localhost:3000). Use the toolbar to open CinePrompt, POV, Chronos, Swag, or Avatar. One server, one URL.

**After editing an app** (e.g. in `cineprompt/`), run `npm run build:apps` again, then refresh the browser.

Copy `hub/.env.example` to `hub/.env.local` for Postgres, Blob, NextAuth when you add them.

## License

Private. All rights reserved.
