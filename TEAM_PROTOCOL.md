# MULTI-AGENT TEAM PROTOCOL & FILE OWNERSHIP MATRIX
Project: **Cisco Cyber Office: Hack The Route**

## 1. Anti-Collision File Ownership Matrix
To eliminate merge conflicts and race conditions during parallel execution, each specialized agent owns strictly decoupled modules:

| Agent Name | Exclusive Write Ownership | Read-Only Access |
| :--- | :--- | :--- |
| **`art-director`** | `src/canvas/roomRenderers.ts`<br>`src/canvas/characterRenderers.ts`<br>`src/canvas/isoMath.ts`<br>`ART_STANDARDS.md` | `src/types/game.ts`<br>`src/components/*` |
| **`cisco-engineer`** | `src/data/workstations.ts`<br>`src/components/PatchRackGame.tsx`<br>`src/components/CrtTerminalGame.tsx`<br>`src/components/UmbrellaSocGame.tsx` | `src/types/game.ts`<br>`src/utils/audio.ts` |
| **`gameplay-dev`** | `src/App.tsx`<br>`src/components/HabboOffice.tsx`<br>`src/components/IsometricOfficeCanvas.tsx`<br>`src/components/AvatarCustomizerModal.tsx`<br>`src/components/RpgSkillModal.tsx`<br>`src/components/BadgeShowcase.tsx`<br>`src/utils/audio.ts` | `src/canvas/*`<br>`src/data/*` |
| **`qa-verifier`** | `pipeline/*`<br>`/tmp/qa_reports/*` | Entire repository (`src/*`, `package.json`) |

> **Shared Contract Rule**: `src/types/game.ts` is the shared interface contract. Modifications to `src/types/game.ts` must be performed first (in the Planning phase by the Lead Orchestrator) before spawning parallel workers.

---

## 2. Deterministic Gatekeeper Workflow
No feature branch or agent task is considered complete until `node pipeline/run_qa_suite.mjs` passes all **5 Hard Gates**:
1. **Gate 1 (Compiler & Bundler)**: `tsc -b && vite build` exits with `0`.
2. **Gate 2 (Canvas Pixel Integrity)**: `<canvas>` pixel buffer proves active rendering (`>= 12` distinct color buckets and `> 25%` non-dark background pixels).
3. **Gate 3 (Zero Horizontal Overflow)**: `scrollWidth <= innerWidth` on both Mobile (`412x915`) and Desktop (`1920x1080`).
4. **Gate 4 (Zero Bounding-Box Overlap)**: Mathematical verification via `getBoundingClientRect()` that `header`, `main`, `section` (Action Dock), and `footer` have `0 px²` overlap.
5. **Gate 5 (Zero Console Errors & E2E Pathfinding)**: Automated click-to-walk navigation to workstations triggers the contextual mission prompt with `0` console/page errors.
