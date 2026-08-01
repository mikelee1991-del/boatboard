# BoatBoard — SoCal boat dashboard

Single-page marine dashboard for a multipurpose fishing / diving / cruising boat based at **Port Royal, King Harbor, Redondo Beach**. Designed for tablet/phone, dark UI, SoCal (~100 nm).

## Quick start

**Local:** open `index.html` (**`file://` works** for most features).  
**Hosted:** https://mikelee1991-del.github.io/boatboard/ (after GitHub Pages is enabled).

1. Allow GPS, or turn **Use device GPS** off and use slip / manual lat-lon (Overview + Settings).
2. AIS: AISStream **blocks browsers** (WebSocket 1006). Run `node ais-relay.mjs YOUR_KEY`, then for **HTTPS / phone** expose it with `cloudflared tunnel --url http://localhost:8765` and paste the **wss://** (or https://) URL in Settings → AIS relay. Plain `ws://192.168.x.x` only works on non-HTTPS pages.
3. Cruise / Windy needs network. On **https** hosting, Map Forecast (`windy-waves-embed.html`) locks wave height to **ft**.

No build step. See **[CONTEXT.md](CONTEXT.md)**, **[PROJECT.md](PROJECT.md)**, and **`.cursor/rules/water-pin-coords.mdc`**.

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
| `seafloor-render.js` | Bathymetry + kelp on-site |
| `coast-overlay-lite.js` | Map shoreline (visual) |
| `pin-feature-groups-data.js` | Feature-group metadata for fish/dive ranking |
| `shipping-lanes-geo.js` | Shipping-lane overlay data (lazy) |
| `windy-waves-embed.html` | Cruise Map Forecast host (locks wave height to **ft**) |

`coast-geo.js` is **audit-only** — never loaded by the dashboard.

## Tabs (nav order)

Overview · Underway · Swell & Ocean · Plankton · Temperature · Cruise · Surf · Wildlife · AIS · Weather · Tides · Fish · Dive

Highlights:

- **Overview** — glance cards + **Use device GPS** toggle (slip / manual when off)
- **Fish / Dive maps** — auto-fit / ranking radius **`FISH_MAP_FIT_NM` / `DIVE_MAP_FIT_NM` = 10 nmi**
- **Cruise** — Windy waves overlay; sector comfort table (shadow model, 5 nm ahead)
- **Temperature** — CoastWatch SST WMS (1-day / 3-day / MUR / Blended)
- **Swell** — energy index **kJ = H² × T** (H ft, T s; proportional index, not SI flux)
- **Tides** — NOAA **9410738** King Harbor

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

- Cruise iframe cache bust: `CRUISE_WINDY_EMBED_VER` (currently **10**) on Windy URLs (`_v=`).
- After bumping embed/host versions or changing `windy-waves-embed.html`, hard-refresh the dashboard (and clear site data if the iframe still shows meters).
- SST/chl metadata caches use `boatCache:*` keys in `localStorage`; refresh button or clear cache if overlays look stuck.

## Live pin counts (Jul 29, 2026)

| List | Pins | Notes |
|------|------|--------|
| `FISH_SPOTS` | **552** | verified 55 · kml 413 · cdfg 126 · userTrusted 438 (flags overlap) |
| `DIVE_SITES` | **358** | verified 57 · kml 134 · cdfg 190 · userTrusted 358 |
| `verified-water-pins.json` | diveKept 57 · fishKept 49 | |
| Pin-trust results | yes 801 · no 8 · unsure 7 | |

## Docs

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Compressed session brief (~1–2 min) |
| [PROJECT.md](PROJECT.md) | Full technical documentation |
| [CONVERSATION.md](CONVERSATION.md) | Historical request log (through ~Jul 24; Jul 29 note at top) |
| `.cursor/rules/water-pin-coords.mdc` | Enforceable pin GPS rules |

GitHub: https://github.com/mikelee1991-del/boatboard
