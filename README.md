# Terra Miner

Terra Miner is a 2D pixel-art mining and learning game built with Svelte 5, TypeScript, and Phaser 3.
You mine underground, recover artifacts, and reinforce knowledge using SM-2 spaced repetition quizzes.

## Tech stack

- Frontend: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3
- Data layer: sql.js (browser SQLite) + generated `public/facts.db`
- Mobile targets: Capacitor (Android/iOS)
- Optional backend: Fastify + TypeScript in `server/`

## Quick start

Prerequisites:

- Node.js 22+
- npm 10+

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Useful dev URL flags:

- `?skipOnboarding=true`
- `?skipOnboarding=true&devpreset=post_tutorial`

## Core commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Generate sprite keys + facts DB, then start Vite dev server |
| `npm run build` | Audit sprites/assets, build `facts.db`, produce production bundle |
| `npm run typecheck` | Run `svelte-check` on app sources |
| `npm run check` | App typecheck + node config typecheck |
| `npx vitest run` | Run unit tests |
| `node tests/e2e/01-app-loads.cjs` | Smoke E2E with diagnostics |
| `npm run analyze` | Build with bundle visualizer (if plugin installed) |

## Project structure

```text
src/
  game/              Phaser scenes, managers, systems
  ui/                Svelte UI components and stores
  services/          Save, auth, facts DB, analytics, sync helpers
  data/              Typed game content, balance values, save types
  events/            Typed EventBus contract
  dev/               Debug bridge and scenario presets
server/              Fastify API (optional backend)
tests/               Unit tests and E2E scripts
scripts/             Build/audit/codegen utilities
docs/                Architecture and operational documentation
```

## Testing

- Unit: `npx vitest run`
- E2E diagnostics:
  - `node tests/e2e/01-app-loads.cjs`
  - `node tests/e2e/02-mine-quiz-flow.cjs`
  - `node tests/e2e/03-save-resume.cjs`
- Playwright test runner: `npx playwright test`

See `docs/TESTING-GUIDE.md` for full workflows and selectors.

## Deployment notes

- Web builds are deployed from `dist/` (Cloudflare Pages scripts are in `package.json`).
- Server deployment options include Docker Compose in `server/docker-compose.yml`.
- Mobile packaging uses Capacitor config from `capacitor.config.ts`.

See `docs/DEPLOYMENT.md` for step-by-step guidance.

## Contributing

- Use strict TypeScript conventions already in the repo.
- Prefer existing patterns in `src/ui/stores/` and `src/game/` before adding new abstractions.
- Run at least:
  - `npm run typecheck`
  - `npx vitest run`
  - `node tests/e2e/01-app-loads.cjs`
- Never commit secrets (`.env`, API keys, private tokens).

## Dev Services (Remote Access)

| Service | Port | URL |
| --- | --- | --- |
| Vite dev server | 5173 | `http://<host>:5173` |
| ComfyUI | 8188 | `http://<host>:8188` |
| JupyterLab | 8888 | `http://<host>:8888` |

- **ComfyUI** — Stable Diffusion node editor for sprite generation (SDXL + pixel art LoRA on RTX 3060 12GB). Venv: `/opt/comfyui-env`, install: `/opt/ComfyUI/`.
- **JupyterLab** — Python notebook environment (no auth). Venv: `/opt/jupyter-env`.

Start services manually if they're not running:

```bash
# ComfyUI (listen on all interfaces)
cd /opt/ComfyUI && /opt/comfyui-env/bin/python main.py --listen 0.0.0.0 --lowvram --preview-method auto --use-split-cross-attention --port 8188 &

# JupyterLab (no auth, listen on all interfaces)
/opt/jupyter-env/bin/jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --ServerApp.token='' --ServerApp.password='' --notebook-dir=/opt/ComfyUI &
```

## Documentation map

Start here for implementation-grounded docs:

- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_INDEX.md`
- `docs/CONFIGURATION.md`
- `docs/SAVE-FORMAT.md`
- `docs/TESTING-GUIDE.md`
