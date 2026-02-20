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

## Hub (Basement Lab)

The Hub uses **Geist Mono** for all UI and unifies all apps with a shared toolbar (app links, history, project, user, day/night). Apps run in iframes; the hub is on port 3000, apps on 5173–5177.

**Run only the Hub:**

```powershell
cd hub
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). App links will point to localhost:5173 etc.; start each app in another terminal if needed.

**Run Hub + all apps (one command from repo root):**

```powershell
npm install
npm run dev:all
```

Then open [http://localhost:3000](http://localhost:3000) and use the toolbar to open CinePrompt, POV, Chronos, Swag, or Avatar.

Copy `hub/.env.example` to `hub/.env.local` for Postgres, Blob, NextAuth, or app URL overrides when you add them.

## License

Private. All rights reserved.
