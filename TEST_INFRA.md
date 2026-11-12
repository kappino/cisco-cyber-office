# E2E Test Infra: Cisco Cyber Office

## Test Philosophy
- Opaque-box, requirement-driven.
- Automated evaluation via Puppeteer deterministic test runner: `pipeline/run_qa_suite.mjs` (5 Gates) and `pipeline/test_full_suite.mjs` (full gameplay integration).
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Coverage
| # | Feature | Requirement Source | Verification Method |
|---|---------|-------------------|---------------------|
| 1 | Steam Particles | R1 | Canvas pixel sampling (Gate 2 & Gate 5) |
| 2 | Active CLI Screens | R1 | Continuous 60 FPS animation loop test |
| 3 | Floor Glows | R1 | Color bucket distribution test (>= 12 unique buckets) |
| 4 | Rotating 3D Cisco Hologram | R1 | Canvas non-black pixel density + visual fidelity |
| 5 | Avatar Seated Pose | R2 | Arrival at terminal/wireshark workstation test |
| 6 | Coffee Emote & Speed Aura | R2 | Bar Napoletano coffee trigger test |
| 7 | Victory Celebration | R2 | Minigame clear event test |
| 8 | Marco CCNA Mini-Quizzes | R3 | Branching modal interaction, answer selection |
| 9 | Quiz Rewards (XP/SP) | R3 | State delta assertion: XP increases, SP increases |
| 10 | SecBot Telemetry & ACL | R3 | SecBot dialogue trigger in -1F Datacenter Vault |
| 11 | Procedural Synthwave BGM | R4 | Web Audio scheduler execution, zero console errors |
| 12 | HUD Audio Mute Sync | R4 | Toggle button event test: muting disables master gain |
| 13 | Enhanced Tactile SFX | R4 | Terminal keydown and SOC threat audio triggers |
| 14 | Production Build & Layout | AC | `npm run build` exits 0; 0 layout overlap/overflow |

## Test Architecture
- Test Runner: Node.js with Puppeteer-core pointing to `/usr/bin/chromium`
- Gate 1: `tsc -b && vite build` (Strict TypeScript, 0 warnings/errors)
- Gate 2: Mobile portrait (`412x915`), 0 horizontal overflow, 0 bounding box collisions, canvas pixel diversity, dismiss intro via `"HO CAPITO"`
- Gate 3: Elevator vertical transit to Underground Datacenter (-1F), canvas verification
- Gate 4: Wireshark DPI minigame interaction, packet inspection, ACL application, badge verification
- Gate 5: Desktop widescreen (`1920x1080`), 0 overflow, 0 collisions, 0 console/runtime errors
