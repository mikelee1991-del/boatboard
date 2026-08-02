# BoatBoard — SoCal boat dashboard

Single-page marine dashboard for a multipurpose fishing / diving / cruising boat based at **Port Royal, King Harbor, Redondo Beach**. Designed for tablet/phone, dark UI, SoCal (~100 nm).

## Quick start

**Local:** open `index.html` (**`file://` works** for most features).  
**Hosted:** https://mikelee1991-del.github.io/boatboard/ (after GitHub Pages is enabled).

1. Allow GPS, or turn **Use device GPS** off and use slip / manual lat-lon (Overview + Settings).
2. AIS: default cloud relay is baked in (`wss://boatboard-ais.aisrelay.workers.dev`). Paste your free [AISStream](https://aisstream.io) API key in Settings. See **[How to connect AIS on phone](#how-to-connect-ais-on-phone)**.
3. Cruise / Windy needs network. On **https** hosting, Map Forecast (`windy-waves-embed.html`) locks wave height to **ft**.

No build step. See **[CONTEXT.md](CONTEXT.md)**, **[PROJECT.md](PROJECT.md)**, and **`.cursor/rules/water-pin-coords.mdc`**.

## How to connect AIS on phone

**Why GitHub can’t host the relay:** GitHub Pages serves static files only — no persistent WebSocket server. Actions runners are ephemeral. AISStream also **blocks browser WebSockets** (close 1006).

**Default for this repo:** `wss://boatboard-ais.aisrelay.workers.dev` (`AIS_HOSTED_RELAY_DEFAULT` in `index.html`). Phones/laptops inherit it when Settings → AIS relay URL is blank.

1. Free [AISStream](https://aisstream.io) API key (GitHub login).
2. Phone → BoatBoard **⚙ Settings** → paste **API key** → **Save** (leave relay blank to use the default).
3. Optional: override relay URL in Settings if you run your own Worker.

No Raspberry Pi required. Advanced self-host: [`ais-relay-worker/README.md`](ais-relay-worker/README.md).

**In-app:** AIS tab → **Setup help**.

**Power-user / LAN:** `node ais-relay.mjs` while a machine is online (see `ais-relay.mjs`).

## GitHub Pages deploy

Entry file is **`index.html`** (legacy `socal-boat-dashboard.html` redirects here). Relative asset paths — works at `/boatboard/` project Pages URL.

1. Push this repo to GitHub (`mikelee1991-del/boatboard` or your fork).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** (workflow: `.github/workflows/pages.yml`), **or** Source: Deploy from branch `main` / root (requires `.nojekyll`, already present).
3. Wait for the Actions run (or first branch deploy), then open `https://<user>.github.io/boatboard/`.

Notes:

- `.nojekyll` — stop Jekyll from hiding underscore-prefixed files.
- `.gitignore` — keeps `node_modules/` and local secrets out of the tree.
- AIS keys stay in browser Settings / `localStorage` (not in the repo). The Windy Map Forecast key is a public client key required by the embed.
- Tooling scripts (`audit-*.js`, pin-trust, imports) stay in the repo for maintainers; they are not loaded by the live dashboard.

## What loads

| File | Role |
|------|------|
| `index.html` | Shell: tabs, GPS, fish, weather, swell, cruise, SST, tides, AIS, wildlife, plankton |
| `dive-engine.js` | `DIVE_SITES`, dive scoring, plan/on-site maps |
| `dive-briefings-data.js` | Pre-dive briefing prose |
| `dive-site-intel.js` | Extra dive intel helpers |
| `seafloor-render.js` | On site + ranked Plan BlueTopo / NCEI DEM + kelp |
| `bluetopo/` | BlueTopo AOIs, Docker→PMTiles pipeline, R2 Worker, split basemap |
| `coast-overlay-lite.js` | Map shoreline (visual) |
| `pin-feature-groups-data.js` | Feature-group metadata for fish/dive ranking |
| `shipping-lanes-geo.js` | Shipping-lane overlay data (lazy) |
| `ais-relay-worker/` | Cloudflare Worker AIS proxy (deploy once for phones) |
| `ais-relay.mjs` | Optional local Node AIS proxy |

`coast-geo.js` is **audit-only** — never loaded by the dashboard.

## Tabs (nav order)

Overview · Underway · AIS · Cruise · Swell & Ocean · Weather · Tides · SST · Plankton · Fish · Dive · Surf · Wildlife

Highlights:

- **Overview** — glance cards + **Use device GPS** toggle (slip / manual when off)
- **Fish / Dive Plan maps** — BlueTopo+DEM (same On site stack); fit **`FISH_MAP_FIT_NM` / `DIVE_MAP_FIT_NM` = 10 nmi**
- **Cruise** — Windy waves overlay; sector comfort table (shadow model, 5 nm ahead); shoreline bacteria default-on
- **SST** — CoastWatch SST WMS (1-day / 3-day / MUR / Blended)
- **Swell** — energy index **kJ = H² × T** (H ft, T s; proportional index, not SI flux)
- **Tides** — NOAA **9410738** King Harbor (plain fetch — mobile CORS-safe)
- Session brief: **[CONTEXT.md](CONTEXT.md)**

## Water-pin GPS (never nudge)

Displayed fish/dive pins use published coords only. Default-trusted without pin-trust “yes”:

1. `verified-water-pins.json` (≥2 sources within ~0.2 NM) → `verified: true`
2. CDFG Artificial Reef Appendix → `cdfgAppendix: true` (`cdfg-artificial-reefs.json`)
3. `San Diego Fishing Spots.kml` → `kmlImported: true`

**User no / unsure** in `pin-trust-review-results.json` overrides any of the above. Other confirmed pins get `userTrusted: true`. Full policy: `.cursor/rules/water-pin-coords.mdc`.

### Pin-trust review workflow

```text
cscript //Nologo build-pin-trust-review.js   # → pin-trust-review-data.js
open pin-trust-review.html                   # yes / no / unsure on imagery
# export → pin-trust-review-results.json
cscript //Nologo apply-pin-trust-yes.js      # stamp / omit live lists
```

Related: `pin-trust-live-exclusions.json`, `auto-seed-default-trust-yes.cjs`, `sync-verified-pins-live.cjs`.

## Audits (after any location edit)

```text
cscript //Nologo audit-all-water-pins.js
```

Hard gates (must exit 0): `scan-fish-onshore.js`, `scan-dive-onshore.js`.  
Advisory: `audit-map-water-pins.js`.

**Do not** run nudge / mega-push / `fix-map-water-pins` / `apply-pv-water-fix` to silence audits — replace coords from published sources or omit the pin.

## Hard-refresh notes

- Settings → **Hard refresh** (also in pin-trust UI) — clears SW/caches and reloads with `?_hr=`.
- Cruise iframe cache bust: `CRUISE_WINDY_EMBED_VER` (currently **15**) on Windy URLs (`_v=`).
- Lazy scripts use `?v=` (e.g. `seafloor-render.js?v=3`, `forecast-charts.js?v=2`, `bluetopo/split-basemap.js?v=2b`).
- SST/chl metadata caches use `boatCache:*` keys in `localStorage`; refresh button or clear cache if overlays look stuck.

## Live pin counts (Aug 2, 2026)

| List | Pins | Notes |
|------|------|--------|
| `FISH_SPOTS` | **~595** | after Franko/PV pin-trust apply (flags overlap) |
| `DIVE_SITES` | **~412** | same |
| Pin-trust prior | yes 894 · no 27 · unsure 7 · pending 1 | see `pin-trust-review.json` |

Full handoff: **[CONTEXT.md](CONTEXT.md)**.

## Docs

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Compressed session brief (~1–2 min) |
| [PROJECT.md](PROJECT.md) | Full technical documentation |
| [CONVERSATION.md](CONVERSATION.md) | Historical request log (through ~Jul 24; Jul 29 note at top) |
| `.cursor/rules/water-pin-coords.mdc` | Enforceable pin GPS rules |

GitHub: https://github.com/mikelee1991-del/boatboard
