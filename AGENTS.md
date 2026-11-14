# Repository Guidelines

## Project Structure & Module Organization

This repository contains a networking and cybersecurity learning game built with React, TypeScript, Vite, and Phaser. React screens and minigames live in `src/components/`; Phaser scenes, textures, and room definitions live in `src/game/`. Shared types, dialogue data, audio, and infrastructure helpers are under `src/types/`, `src/data/`, and `src/utils/`. Legacy canvas renderers are in `src/canvas/`.

`backend/` contains the FastAPI orchestrator and CML/Ollama integrations. Static game assets live in `public/assets/`; browser automation lives in `pipeline/`. Consult `TEST_INFRA.md` for QA expectations and `ART_STANDARDS.md` before changing artwork.

## Build, Test, and Development Commands

- `npm install`: install frontend and browser automation dependencies.
- `npm run dev -- --host`: start Vite, normally on port 5173.
- `npm run build`: run TypeScript project checks and generate `dist/`.
- `npm run lint`: run ESLint with TypeScript and React Hooks rules.
- `npm run preview`: serve the production build locally.
- `docker compose up -d --build`: build and serve the frontend on port 3000.
- `pip install -r backend/requirements.txt`, then `uvicorn backend.main:app --reload`: install and run the optional API from the repository root.

## Coding Style & Naming Conventions

Follow surrounding code: TypeScript generally uses two-space indentation, single quotes, and semicolons; Python uses four spaces. Use PascalCase for React components and Phaser scene classes, camelCase for functions and variables, and snake_case for Python identifiers. Keep shared gameplay contracts in `src/types/`. TypeScript strict mode is enabled. ESLint is configured in `eslint.config.js`; no dedicated formatter is configured.

## Testing Guidelines

Browser tests use Puppeteer Core and expect Chromium at `/usr/bin/chromium`. Start the dev server before running `node pipeline/run_qa_suite.mjs` or `node pipeline/test_full_suite.mjs`. For Phaser changes, use `node pipeline/run_fuori_rete_e2e.mjs --help` to select relevant gates. Name focused scripts `pipeline/test_<feature>.mjs`.

Verify gameplay progression, mobile/desktop layout, assets, and browser errors. No numerical coverage threshold is configured. Run build and lint checks before submitting changes.

## Commit & Pull Request Guidelines

History commonly uses `feat:`, `feat(scope):`, `chore:`, and `ci:` prefixes, alongside imperative summaries. Follow that pattern with a concise description. PRs should explain the affected gameplay or infrastructure behavior, link relevant issues, list validation performed, and include screenshots for visual changes.

## Security & Configuration

Keep CML credentials and local service configuration out of commits. The backend loads `backend/.env`; verify exclusion before adding configuration files because `.env` is not currently ignored.
