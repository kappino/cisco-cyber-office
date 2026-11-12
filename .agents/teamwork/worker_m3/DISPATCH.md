## 2026-11-12T14:31:42Z
You are worker_m3.
Your working directory is: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/worker_m3
The workspace directory is: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
The user's original request is located at: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/ORIGINAL_REQUEST.md
The project specification is at: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/PROJECT.md

Read ORIGINAL_REQUEST.md and PROJECT.md first.

Also read the Explorer blueprints:
1. /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_1/handoff.md
   (Patch: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_1/m3_1_avatar_sitting.patch)
2. /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_2/handoff.md
3. /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your tasks for Milestone 3 (Requirement R2: Living Avatar & Diegetic Canvas Interactions):
1. In `src/canvas/characterRenderers.ts`:
   - Update `drawCharmingHabboAvatar`:
     - Seated pose: lower upper body by 8px, horizontal bent thighs on chair cushion, vertical lower legs, typing hands on desk with alternating finger tap animation (`frame % 10 < 5`).
     - Coffee break emote bubble: floating diegetic bubble above nametag with gentle bob, displaying steaming espresso cup / pizza slice.
     - Golden speed trails: 3 golden after-image foot echoes with decaying alpha when walking under caffeine boost.
     - Victory celebration: parabolic sine-wave leap (`-Math.abs(Math.sin(frame * 0.18)) * 18`), cheerful raised arms pose (`\o/`), happy squinting eyes (`^^`), and ring of 8 golden sparkle stars orbiting head.
2. In `src/components/IsometricOfficeCanvas.tsx` and `src/components/HabboOffice.tsx`:
   - Station sitting & auto-orientation: when stopping near terminal (5, 3.2) or wireshark (2.5, 3.2) (dist < 0.45 && !isWalking), set `isSitting = true` and orient `dir = 'NW'`.
   - Caffeine boost timer: 300 frames (5s) countdown on coffee click, 1.5x speed boost, circular historical position buffer for speed trails with zero heap allocation.
   - Victory celebration trigger: detect when `level1Done`..`level4Done` transitions from false to true, trigger 180 frames celebration.
3. Verification:
   - `npm run build` (`tsc -b && vite build`) — MUST exit with code 0.
   - `node pipeline/run_qa_suite.mjs` — MUST pass 100% across all 5 Gates.
   - `node pipeline/test_full_suite.mjs` — MUST pass 100%.
   - `npm run lint` — MUST pass with 0 errors.

Write your handoff report to:
/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/worker_m3/handoff.md
Update your progress in:
/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/worker_m3/progress.md

When complete, send a message to orchestrator_1 (conversationId: 8ca0f683-8837-4e16-a1bf-0380ef6156f8) summarizing your implementation and verification results.
