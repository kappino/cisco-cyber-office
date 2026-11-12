# CISCO CYBER OFFICE // ART & ENGINEERING STANDARDS
Version: 1.0 (The Big Hack 2026 - Challenge 04)

## 1. Isometric Projection Specification
- **Projection Ratio**: 2:1 (dimetric/isometric standard for retro games)
- **Base Tile Width (W)**: 96 pixels
- **Base Tile Height (H)**: 48 pixels
- **Origin Offset**: `originX = canvasWidth / 2`, `originY = 205`
- **Projection Math**:
  - `screenX = (gridX - gridY) * (W / 2) + originX`
  - `screenY = (gridX + gridY) * (H / 2) + originY`
  - `gridX = ((screenX - originX) / (W / 2) + (screenY - originY) / (H / 2)) / 2`
  - `gridY = ((screenY - originY) / (H / 2) - (screenX - originX) / (W / 2)) / 2`

## 2. Depth Sorting & Occlusion Rule
- All entities (avatars, furniture, interactive terminals, decorative props) MUST declare a depth:
  `depth = gridX + gridY`
- Rendering pipeline MUST sort entities in ascending order before drawing:
  `entities.sort((a, b) => a.depth - b.depth)`
- Every entity touching the floor MUST draw an oval drop shadow with `rgba(0, 0, 0, 0.55)` at `(screenX, screenY + 12)`.

## 3. Strict Color Palette
- **Cisco Primary**: `#00bceb` (Cyan), `#0369a1` (Deep Blue), `#0284c7` (Napoli Azure)
- **Status Indicators**: `#10b981` (Online/Green), `#f59e0b` (Warning/Amber), `#ef4444` (Critical/Red)
- **Loft Brick Walls**: `#7c2d12` (Shadowed Brick), `#9a3412` (Sunlit Terracotta), `#cbd5e1` (Stone Cap)
- **Oak Parquet Flooring**: `#b45309` (Tile A), `#92400e` (Tile B), `#78350f` (Border Bevel)
- **Naples Twilight Gradient**:
  - `#311042` (Twilight Violet)
  - `#701a75` (Deep Magenta)
  - `#f97316` (Sunset Orange)
  - `#fde047` (Vesuvio Sun Gold)
  - `#0284c7` (Gulf Sea Blue)

## 4. UI Architecture & Mobile Rules
- **No Overlapping Floating Windows**: Floating cards positioned `absolute bottom-*` on top of each other are strictly prohibited.
- **Unified Action Dock**: All contextual UI (Marco dialogues, station interaction cards, quick navigation pills) must be rendered sequentially inside a dedicated docked container in normal document flow.
- **Zero Missing Glyphs**: Never use raw Unicode emojis for functional UI buttons. Always use SVG icons (`lucide-react`) to ensure 100% cross-platform compatibility.

## 5. Quality Assurance Gate
- `npm run build` (`tsc -b && vite build`) must exit with code 0.
- Puppeteer E2E visual suite (`pipeline/run_qa_suite.mjs`) must pass on both Mobile (412x915) and Desktop (1920x1080) with zero visual collisions.
