# RF Coverage Planner — CLAUDE.md

## Project overview

Desktop app (Electron + vanilla JS) for planning RF wireless microphone coverage in live events. Lets engineers draw a venue floor plan, place antennas, wire a signal chain (splitters/cables), and compute RF heatmaps.

**Stack:** Electron 33, no bundler/framework, single-file frontend (`index.html` ~263 KB), Supabase (Google OAuth + cloud project storage).

## File structure

```
main.js       — Electron entry: local HTTP server on 127.0.0.1:7359, BrowserWindow, menu
index.html    — Entire UI + all application logic (CSS + HTML + JS in one file)
package.json  — npm scripts: start / dist:mac / dist:win / dist:linux
```

## Running locally

```bash
npm install
npm start          # launches Electron dev window (DevTools available via Vista menu)
```

Build distributables:

```bash
npm run dist:mac   # → .dmg (x64 + arm64)
npm run dist:win   # → NSIS installer (x64)
npm run dist:linux # → AppImage (x64)
```

## Architecture inside index.html

All state lives in a single `S` object (defined around line 2048):

- `S.els[]` — venue geometry elements (shapes: `triangular`, `quadrangular`, `arc`, `superelliptic`; types: Listening, Obstacle, Stage, Wall, Ceiling)
- `S.antennas[]` — placed antennas with TX power, gain, beamwidth, frequency, height, chain loss
- `S.racks[]` — rack groups with receiver channels and wiring
- `S.rdNodes[]` / `S.rdConns[]` — RF signal chain diagram nodes and connections
- `S.coverage` — computed RSSI heatmap `{data, cols, rows, mnX, mnY, resM}`
- `S.tv` / `S.pv` — viewport state for top-view and profile-view canvases
- `S.hist[]` / `S.histIdx` — undo/redo snapshots of `S.els`

### Rendering

Two HTML Canvas elements:
- **Top view** (`topCanvas`) — overhead floor plan + antennas + optional coverage heatmap
- **Profile view** (`profileCanvas`) — side elevation of selected element

Key render functions: `render()` → `renderTop()` + `renderProfile()` → `drawElTop()` / `drawElProfile()`.

Coordinate system: world space in **metres**, canvas in pixels. Conversion helpers: `w2t()` / `t2w()` (world↔top canvas), `w2p()` (world↔profile canvas).

### RF propagation models (`calcRSSI`, ~line 2682)

| Model | Description |
|-------|-------------|
| `fspl` | Free-space path loss — ideal for outdoors |
| `logdist` | Log-distance n=2.5 — generic indoor |
| `layher` | Layher scaffold stage n=3.0 + 3 dB scattering + 5 dB body absorption through Stage elements |
| `multiwall` | FSPL + obstacle attenuation (10 dB per Obstacle/Wall element crossed) |

RSSI formula: `TX_dBm + gain_dBi − path_loss_dB − pattern_rolloff_dB`

Directional rolloff: quadratic, 0 dB at beam edge → −30 dB at 180°.

### Signal chain diagram (`renderConnDiagram`, ~line 4943)

Nodes: rack groups, RF splitters, RF cables, antenna endpoints. Connections stored as `{id, from, to, fromPort, toPort}`. `calcDiagramChainLoss()` walks the graph from an antenna node back to its rack source to compute effective TX and chain loss, then writes back to `S.antennas` via `_refreshAntennaFromSource()`.

### Antenna models (`ANT_MODELS`, ~line 2326)

Catalog of Shure, Sennheiser, Wisycom, and Sound Devices models with `gain`, `beamwidth`, `freqMin/Max`, `active`, `notes`. Splitter/combiner catalog in the rack diagram section (~line 3517).

### Supabase integration

- Auth: Google OAuth implicit flow; redirect lands on `http://localhost:7359` (handled in `main.js` by serving `index.html` for all routes)
- Database table: `rf_projects (id, user_id, name, data jsonb, updated_at)`
- State serialized via `_serializeState()` / `_deserializeState()` (serializes `S.els`, `S.antennas`, `S.racks`, `S.rdNodes`, `S.rdConns`, `S.tv`, `S.pv`)
- Required SQL (run once in Supabase SQL editor — comment block near line 2029 in `index.html`)

## Key conventions

- **No build step.** All JS/CSS is inline in `index.html`. Avoid introducing a bundler unless the project explicitly grows beyond this.
- **State mutations must call `refreshAll()`** (or the narrower `updateEls()` / `render()`) to keep the UI in sync.
- **Undo/redo** only covers `S.els`. Call `saveHist()` before any destructive geometry edit. Antennas and rack state are not in the undo stack.
- **World units are metres.** All geometry coordinates, distances, and heights are stored in metres. Display-only conversions happen in render functions.
- **`S.selId`** tracks the selected element; **`S.selAntId`** tracks the selected antenna. Keep these consistent when adding/removing items.
- DevTools are visible only when `!app.isPackaged` (development mode).

## Supabase credentials

Credentials are hardcoded in `index.html` (~line 2025). The anon key is safe to expose publicly (Supabase RLS enforces access). The `rf_projects` table must have RLS enabled with a policy restricting rows to `auth.uid() = user_id`.
