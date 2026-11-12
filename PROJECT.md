# Project: Cisco Cyber Office (The Big Hack 2026 / Challenge 04)

## Architecture
The application is a high-fidelity retro Habbo/Cyberpunk isometric cybersecurity simulator built with React 18, Vite 5, TypeScript 5.6 (strict), TailwindCSS 3.4, and Web Audio API.

### Systems Breakdown
1. **Isometric Canvas Engine** (`src/canvas/*`, `src/components/IsometricOfficeCanvas.tsx`):
   - 2:1 dimetric projection (Tile 96x48, origin canvasW/2, 205).
   - 60 FPS deterministic render loop with depth sorting (`depth = gridX + gridY`).
   - Two room environments: Panoramic Office (1F) with Golfo di Napoli & Vesuvio, and Underground Datacenter Vault (-1F) with cold-aisle server racks.
2. **Atmosphere & Particle System** (`src/canvas/roomRenderers.ts`):
   - Pure procedural mathematical animations (zero garbage collection).
   - Bar Napoletano espresso steam, active multi-line scrolling CLI monitors, pulsing neon glows, parquet sunset reflections, datacenter blue sub-floor glow, and 3D rotating Cisco hologram with scanlines.
3. **Living Avatar System** (`src/canvas/characterRenderers.ts`):
   - Procedural pixel/Habbo avatar rendering with customizable appearance.
   - Dynamic states: idle breathing, walking cycle, chair sitting pose with typing hands, caffeine boost emote bubble (steaming espresso cup / pizza slice) + golden speed aura trail, victory celebration leap with orbiting golden sparkle stars.
4. **Gamification, Dialogue & CCNA/CyberOps Quizzes** (`src/data/ciscoQuizzes.ts`, `src/components/NpcDialogueModal.tsx`, `src/App.tsx`, `src/components/HabboOffice.tsx`):
   - Branching dialogue tree for Marco (Senior NetAdmin) offering interactive Cisco CCNA mini-quizzes:
     - Quiz 1: Trunk vs Access VLAN (802.1Q tagging)
     - Quiz 2: Default Gateway Layer 3 IP routing
     - Quiz 3: TCP 3-Way Handshake (SYN -> SYN-ACK -> ACK)
     - Quiz 4 (Bonus): CyberOps Extended ACL syntax for C2 containment
   - Immediate rewards (+120 XP, +1 Skill Point) with confetti burst and sound hooks.
   - SecBot Sentinel AI in Datacenter Vault with humorous environmental telemetry, NetFlow/SPAN analysis, and copyable Cisco IOS ACL mitigation command blocks.
   - Strict preservation of the `"HO CAPITO"` initial greeting button contract to guarantee 100% QA Gate 2 pass.
5. **Procedural Web Audio Engine** (`src/utils/synthwaveBgm.ts`, `src/utils/audio.ts`):
   - 100% Web Audio API synthesis without external audio files (zero bundle bloat).
   - Master Gain -> BGM Gain / SFX Gain topology.
   - 120 BPM D-minor 4-bar looping synthwave/chiptune soundtrack (galloping bassline, 16th-note square arpeggios, 8-bit drum kit, warm cyber pad) driven by a lookahead clock scheduler.
   - HUD audio button synchronously mutes/unmutes both BGM and SFX.
   - Enhanced tactile SFX: IBM Model M mechanical keyboard click in terminal, soft cyber alarm during ransomware detection, walking footsteps, espresso coffee siphon sound.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Espresso Steam Particles | Procedural steam rising from espresso cup at Bar Napoletano | M2 | R1 |
| 2 | Active CLI / Packet Screens | Scrolling code/threat lines on Admin desk, Wireshark, SOC threat wall | M2 | R1 |
| 3 | Floor Glows & Reflections | Parquet sunset reflections on 1F, blue cold-aisle glow on -1F | M2 | R1 |
| 4 | Rotating 3D Cisco Hologram | 3D rotating 9-bar Cisco bridge hologram on central carpet (4,4) | M2 | R1 |
| 5 | Avatar Seated Pose & Orientation | Avatar sits and types when stopping near desk/console, facing workstation | M3 | R2 |
| 6 | Coffee Emote & Golden Speed Trails | Floating emote bubble (espresso/pizza) + 3-point golden speed trail on boost | M3 | R2 |
| 7 | Victory Celebration Jump & Stars | Sine-wave celebration leap with happy eyes and orbiting golden stars on level clear | M3 | R2 |
| 8 | Marco CCNA Mini-Quizzes | 3+ multiple-choice CCNA quizzes (VLAN Trunk/Access, Gateway, 3-Way Handshake) | M4 | R3 |
| 9 | Quiz Gamification Rewards | Immediate XP and Skill Point rewards + confetti + audio cues on correct quiz answer | M4 | R3 |
| 10 | SecBot Telemetry & Mitigation | Humorous datacenter telemetry, NetFlow analysis, copyable Cisco IOS ACL commands | M4 | R3 |
| 11 | Procedural Synthwave BGM | 120 BPM D-minor looping 4-layer synthwave chiptune soundtrack via Web Audio | M1 | R4 |
| 12 | Synchronized HUD Audio Toggle | HUD volume button mutes/unmutes BGM and all SFX in unison | M1 | R4 |
| 13 | Enhanced Tactile SFX Suite | Mechanical IBM typing click, soft cyber alarm, footsteps, coffee SFX | M1 | R4 |
| 14 | E2E QA Suite Verification | 100% pass on npm run build, pipeline/run_qa_suite.mjs (5 Gates), and test_full_suite | M5 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Procedural Synthwave Audio & SFX | Web Audio BGM engine, HUD sync, tactile mechanical click, cyber alarm, footsteps | none | DONE |
| 2 | M2: Atmosphere, Particles & 3D Hologram | Steam plume, active CLI screens, floor glows, rotating 3D Cisco hologram | none | DONE |
| 3 | M3: Living Avatar Interactions & Emotes | Seated pose & typing, coffee emote bubble & speed trails, victory jump & stars | M2 | DONE |
| 4 | M4: Gamification, Dialogues & Quizzes | Marco CCNA branching quiz tree, SecBot telemetry & ACL cheat-sheet, XP/SP rewards | M1 | PLANNED |
| 5 | M5: E2E Integration & Full QA Verification | Full acceptance verification, 5 QA Gates, full test suite, adversarial review | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Audio Engine ↔ UI / Game Components
- `sound.toggleMute(): boolean` — Toggles mute on MasterGain, pauses/resumes BGM sequencer, persists to localStorage.
- `sound.startBgm(): void` — Starts the 120 BPM synthwave chiptune scheduler if unmuted.
- `sound.playMechanicalKey(): void` — Dual-transient IBM Model M keystroke click.
- `sound.playCyberAlarm(): void` — Soft futuristic twin-frequency alarm (720Hz/880Hz).
- `sound.playFootstep(): void` — Subtle cadence footstep tap for avatar movement.

### Canvas Renderers ↔ Isometric Office Canvas
- `drawSteamPlume(ctx, sx, sy, frame, count)` in `roomRenderers.ts`
- `drawCiscoHologram(ctx, gx, gy, canvasW, frame)` in `roomRenderers.ts`
- `drawCharmingHabboAvatar(ctx, p, canvasW, dir, isWalking, frame, avatar, playerLevel, isSitting, caffeineBoostTimer, celebrationTimer)` in `characterRenderers.ts`

### Dialogue & Quiz System ↔ App State
- `src/data/ciscoQuizzes.ts` exports `CiscoQuiz`, `CISCO_CCNA_QUIZZES`, `SECBOT_TELEMETRY`, `SECBOT_ACL_SNIPPETS`.
- `App.tsx` provides `handleAwardReward(xp: number, skillPoints?: number)` and maintains `solvedQuizzes: string[]`.
- `NpcDialogueModal.tsx` receives `npcId: 'marco' | 'secbot'`, `onClose: () => void`, `onAwardReward: (xp: number, sp: number) => void`, `solvedQuizzes: string[]`.

## Code Layout
- `src/utils/synthwaveBgm.ts` — Procedural Web Audio synthwave sequencer & synthesizer voices.
- `src/utils/audio.ts` — SoundEngine singleton, Master/BGM/SFX routing, SFX implementations.
- `src/canvas/roomRenderers.ts` — Room structures, furniture, steam, monitor animations, sunset sheen, blue glow, hologram.
- `src/canvas/characterRenderers.ts` — Avatar sprites, seated pose, typing hands, emote bubbles, speed aura, celebration stars.
- `src/canvas/isoMath.ts` — Coordinate transforms, dimetric constants, entity contracts.
- `src/components/IsometricOfficeCanvas.tsx` — Canvas lifecycle, 60 FPS requestAnimationFrame loop, proximity detection, state hooks.
- `src/data/ciscoQuizzes.ts` — CCNA quiz questions, options, explanations, SecBot telemetry data.
- `src/components/NpcDialogueModal.tsx` — Habbo retro dialogue modal with keyboard shortcuts and reward feedback.
- `src/components/HabboOffice.tsx` — Main game scene, HUD, action dock, elevator, modal triggers.
- `src/App.tsx` — Root state container, XP & skill points dispatcher, level progression.
