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
labtools/
├── avatar/      # Avatar style standardization
├── chronos/     # Time-shift for keyframes
├── cineprompt/  # Cinematic prompt generator
├── pov/         # POV / concept art
├── swag/        # Logo mockups
└── README.md
```

## License

Private. All rights reserved.
