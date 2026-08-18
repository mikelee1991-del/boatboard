# BoatBoard — Compressed context

Read this first in a new session. Details: `README.md`, `PROJECT.md`, `.cursor/rules/water-pin-coords.mdc`.

## Product

Tablet/phone **BoatBoard** for a boat at **Port Royal, King Harbor** (33.84817, −118.39633). SoCal fishing, diving, cruising, swell-aware nav (~100 nm).

- **Live:** https://mikelee1991-del.github.io/boatboard/
- **Entry:** `index.html` (+ `dive-engine.js`). Legacy `socal-boat-dashboard.html` redirects here.
- **No build** for the dashboard. Dark, mobile-first. No onboard AIS TX — device GPS + AISStream via Cloudflare Worker.

**Tab order (nav):** Overview → Underway → AIS → Cruise → Swell & Ocean → Weather → Tides → SST → Plankton → Fish → Dive → Lobster → Surf → Wildlife

## Hard policies

- **Never guess / round / nudge** fish or dive GPS. Trust / reject / omit only. Display published coords as-is.
- **Pin-trust review before live promote** for Franko Catalina + PV candidate batches (`pin-trust-extra-candidates.js` → review → export → `apply-pin-trust-yes.js`).
- Many candidate sources are **WGS84 reference only — not for navigation** (Franko Maps, USGS GNIS labels, etc.).
- Default-trusted without pin-trust yes: `verified: true` (multi-source log), `cdfgAppendix: true`, `kmlImported: true`. User **no/unsure** overrides. Confirmed yes → `userTrusted: true`.
- Full rules: `.cursor/rules/water-pin-coords.mdc`.

## Live counts (Aug 2, 2026 — after last apply)

From `pin-trust-review.json` / live arrays (~verify with `FISH_SPOTS.length` / `DIVE_SITES.length` in console):

| List | Pins | Notes |
|------|------|--------|
| `FISH_SPOTS` | **~595** | verified / kml / cdfg / userTrusted flags overlap |
| `DIVE_SITES` | **~412** | same trust model |
| Pin-trust prior | yes **894** · no **27** · unsure **7** · pending **1** | rebuild merges by id/coords |

Franko Catalina GPS pins + PV duals went through pin-trust. Relative Franko names **without GPS** stay in `franko-catalina-relative-no-gps.json` (not mapped — no invented coords). Ship Rock duals reviewed by user.

## Major systems

### Pin-trust review
`pin-trust-review.html` (+ `build-pin-trust-review.js` → `pin-trust-review-data.js`).

- Joint fish+dive **duals** (same coords → one review)
- **Morton** geo sort (nearby pins clustered in Next / Next-unreviewed)
- Default **unreviewed** until verdict; live adds ≠ auto-queue (rebuild after new candidates)
- Lat/lon **uncertainty boxes** on map
- Basemap: same **BlueTopo + NCEI DEM** stack as On site (`seafloor-render.js`)
- **Hard refresh** in header + help panel
- Export → `pin-trust-review-results.json` → `cscript //Nologo apply-pin-trust-yes.js`

Related: `pin-trust-live-exclusions.json`, `pin-trust-extra-candidates.js`, `auto-seed-default-trust-yes.cjs`, `sync-verified-pins-live.cjs`.

### Sites
Live fish/dive lists in `index.html` / `dive-engine.js`. Feature groups: `pin-feature-groups-data.js` (~1 nm same-reef modules). Map fit **10 nmi**; picker pools **25**. Audits: `cscript //Nologo audit-all-water-pins.js` (hard gates: onshore scans). **Do not** run nudge/fix scripts.

### Seafloor
- **On site** (Fish + Dive): `SeafloorRender` — BlueTopo hillshade + NCEI DEM (+ ENC / Ocean / Satellite toggles). Fit ~1300 ft.
- **Ranked Fish / Dive Plan maps:** same SeafloorRender BlueTopo+DEM stack (`attachSeafloorPlanBasemap` / `seafloorDem: true`).
- **AIS** (and other non-plan maps): still **split** imagery(land) / BlueTopo(water) via `bluetopo/split-basemap.js`.
- **Fish Plan vessel seafloor chart removed** — only On site mark chart remains (boat center + mark).
- Honest limits: not for navigation; **King Harbor BlueTopo often undelivered** (sparse S3 / transparent cells).

### AIS
- Relay: `wss://boatboard-ais.mikelee1.workers.dev` (`AIS_HOSTED_RELAY_DEFAULT`)
- Worker must **subscribe-after-client** (mobile-safe; idle upstream closes in ~3s) — see `ais-relay-worker/`
- Need free AISStream **API key** in Settings; AIS tab → **Setup help**
- Optional local: `ais-relay.mjs`

### Bacteria (FIB)
Cruise default-on Enterococcus stations (LA/OC/Catalina). Surf/Dive spots within **500 m** of elevated → red **!** on marker + note. Not mid-channel safety.

### Scores
- Dive: `scoreDive` · Fish bite: `fishBiteScore` — recalibrated SoCal-relative (**normal ~45–60**, **good ≥82**)
- Glance bite = map Bite (**pure** `fishBiteScore`); list **order** uses modest site-fit only
- Continuous **16-stop** traffic-light colormap (bright red = worst → bright green = best) + status-labeled ramp legends under Plan maps (`SCORE_COLOR_STOPS` / dive twin / lobster hunt)
- Fish plankton: NOAA VIIRS **4 km** point samples via **PFEG ERDDAP** (JSONP + multi-day cloud lookback + mark cell); Plankton tab NASA GIBS remains **1 km** map detail

### Lobster
- Tab: habitat hunt planner (`lobster-engine.js`) — structure pins from Fish + Dive (no new GPS); excludes known SMR/no-take by name + MPA polygons
- Season banner (CDFW recreational open/close); HAB/shellfish caution from cached C-HARM; night + moving tide + calm seas score highest; out-of-season scores capped
- Map: same BlueTopo+DEM Plan basemap + MPA overlay; hoop / scuba / freedive methods noted on pins

### Briefings & forecasts
- Dive: curated `dive-briefings-data.js` + synth `briefing-synth.js`
- Fish: `fish-spot-intel.js` + synth
- **Today’s conditions** live strip on briefings
- Bite/dive charts: **−18h / +72h** with **PLAN** marker — `forecast-charts.js?v=2`

### Misc
- SST tab label (was Temperature)
- Tides: NOAA **9410738**; mobile CORS — plain GET, no custom headers (`fetchJSON`)
- Hard refresh: Settings + pin-trust; busts via `?_hr=` on assets and script `?v=`
- Cruise Windy: `CRUISE_WINDY_EMBED_VER` (**15**); http(s) → `windy-waves-embed.html` ft lock; `file://` embed2 may GeoIP meters
- Swell energy: **kJ = H² × T** (H ft, T s)

## Key paths

| Path | Role |
|------|------|
| `index.html` | Shell, tabs, fish, AIS, cruise, SST, GPS, FIB |
| `dive-engine.js` | `DIVE_SITES`, `scoreDive`, Plan/On site |
| `lobster-engine.js` | Lobster hunt score, season, ranked structure map |
| `seafloor-render.js` | BlueTopo+DEM On site + Plan basemap |
| `bluetopo/` | Split basemap, PMTiles pipeline, AOIs |
| `ais-relay-worker/` | Cloudflare `wss://` AIS proxy |
| `briefing-synth.js` | Template dive/fish briefings + conditions strip |
| `fish-spot-intel.js` | Curated fish intel |
| `forecast-charts.js` | Bite/dive score charts + PLAN marker |
| `pin-trust-review.html` | Human trust review UI |
| `build-pin-trust-review.js` / `apply-pin-trust-yes.js` | Build queue / apply yes→live |
| `franko-catalina-relative-no-gps.json` | Franko names without GPS (archive) |
| `windy-waves-embed.html` | Cruise ft lock host |
| `.github/workflows/pages.yml` | Pages deploy |

Do not edit `socal-dive-conditions.html`.

## Ops

- Deploy: push `main` → Actions Pages (`.nojekyll`)
- After asset/script bumps: **Hard refresh** / `?_hr=` / bump `?v=` on lazy scripts
- **Don’t commit probe noise** unless intentional: `package.json` playwright deps, `_bluetopo_probe*`, `probe-bt-pane.cjs` / `verify-bt-split-v2.cjs` scratch, etc. Keep `package.json` AIS-only (`ws`)

## Open / known limits

- KH / day-trip AOI **BlueTopo gaps** (transparent tiles)
- Relative Franko sites **without GPS** not on map
- Ship Rock duals already user-reviewed — don’t re-invent coords
- Scores are **heuristics**, not catch/dive-quality truth
- `coast-geo.js` audit-only (phantom chords possible); maps use `coast-overlay-lite.js`
