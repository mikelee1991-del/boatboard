# AGENTS.md

## Cursor Cloud specific instructions

BoatBoard is a **static single-page marine dashboard**. There is no build step and no
bundler — the browser loads `index.html` plus a set of sibling `*.js`/`*.json` assets
directly (GitHub Pages serves the whole repo root). Most of the repo's top-level
`*.js` files (`audit-*.js`, `apply-*.js`, `analyze-*.js`, imports, pin-trust tooling)
are **maintainer scripts that are never loaded by the live dashboard** — do not assume
editing them affects the app.

### Run the dashboard (primary "service")
- Serve the repo root over HTTP and open `index.html`, e.g. `python3 -m http.server 8080`
  (run from the repo root) then browse `http://localhost:8080/index.html`. `npx serve`
  works too. `file://` also works for most features per the README, but a local HTTP
  server is the most reliable dev setup.
- No build/compile step exists; edit a file and hard-refresh the browser to see changes.
- Expect a **"GPS error"** banner in the sandbox (geolocation is denied/times out). This
  is normal — block the permission prompt; the app falls back to the cached Port Royal
  slip position (33.848167, -118.396333) and remains fully usable.
- Many panels fetch **external network resources** (Windy embed, NOAA tides/CoastWatch,
  Open-Meteo, AISStream, PFEG/NASA ERDDAP). These may be blocked/slow in a sandboxed VM;
  the shell UI, tabs, and locally-bundled fish/dive spot data still render regardless.

### Lint / test
- There is **no lint config and no automated test framework** in this repo (no ESLint,
  no Jest/Vitest, no `test` npm script).
- The closest thing to tests are node "audit gates" referenced in `README.md`
  (`scan-fish-onshore.js`, `scan-dive-onshore.js`, `audit-all-water-pins.js`). These are
  maintainer data-integrity checks for pin coordinates, not app tests.
- The `.cursor/hooks` `afterFileEdit` audit hook is a **PowerShell/Windows-only** script
  and does not run on the Linux cloud VM.

### Optional services (not needed to run/verify the dashboard)
- **AIS relay:** `node ais-relay.mjs` (a local WebSocket proxy; `npm run ais-relay`).
  Requires the `ws` dependency (installed by `npm install`) and a free AISStream API key
  to actually stream data.
- **Cloudflare Worker** in `ais-relay-worker/` is **deploy-only** (`wrangler`), and the
  `bluetopo/` PMTiles pipeline is Docker-based — neither is required for local dashboard
  development.
