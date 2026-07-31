# BoatBoard — Southern California Boat Dashboard

Technical documentation for the **BoatBoard** single-page dashboard used on a tablet or phone aboard a multipurpose fishing/diving/cruising boat based at **Port Royal, King Harbor, Redondo Beach**.

Compressed session brief: **`CONTEXT.md`**. Quick start: **`README.md`**. Pin GPS policy: **`.cursor/rules/water-pin-coords.mdc`**.

## Purpose

BoatBoard consolidates Southern California marine forecasts, GPS position, AIS traffic, dive/fish planning, SST/plankton overlays, wildlife intel, surf estimates, and swell-aware navigation into one dark, high-contrast, mobile-first HTML application. It is scoped to roughly **100 nm** from King Harbor and does **not** require the boat to have its own MMSI/AIS transmitter.

## Repository layout

| File | Role |
|------|------|
| `index.html` | Main application: UI, tabs, maps, AIS, weather, fishing, surf, cruise (Windy), SST, plankton, wildlife, GPS, Underway satellite radar |
| `socal-boat-dashboard.html` | Legacy bookmark redirect → `index.html` (GitHub Pages entry is `index.html`) |
| `.nojekyll` | Required for GitHub Pages (disables Jekyll) |
| `.github/workflows/pages.yml` | GitHub Actions Pages deploy on push to main/master |
| `dive-engine.js` | Dive site library (**358 sites**), scoring (ported from DiveCast), Plan/On site rendering, dive maps, briefing UI |
| `dive-briefings-data.js` | Pre-dive briefing content — `window.__BOAT_DIVE_BRIEFINGS__` keyed by site id |
| `dive-site-intel.js` | Extra dive intel helpers |
| `seafloor-render.js` | NOAA/Open Waters bathymetry + CDFW kelp overlay (SVG/canvas host) |
| `coast-geo.js` | Audit-only high-res coastline (CScript pin tools). May contain phantom chords — not used by maps |
| `coast-overlay-lite.js` | **Map display** shoreline (~100 ft, ~100 NM of slip). Loaded by dashboard |
| `build-coast-overlay-lite.ps1` / `.js` | Rebuild overlay from OSM (`coast-osm.json`). **Do not** rebuild overlay from `coast-geo.js` |
| `pin-feature-groups-data.js` | Feature-group metadata for fish/dive ranking |
| `shipping-lanes-geo.js` | Shipping-lane overlay data (lazy) |
| `windy-waves-embed.html` | Cruise Map Forecast host — locks wave height to **ft** via `metric_waves` |
| `verified-water-pins.json` | Multi-source verified pins (fishKept / diveKept) |
| `cdfg-artificial-reefs.json` | CDFG Artificial Reef Appendix source |
| `San Diego Fishing Spots.kml` | KML import source (`kmlImported`) |
| `pin-trust-review.html` + `build-pin-trust-review.js` / `apply-pin-trust-yes.js` | Human pin-trust review pipeline |
| `pin-trust-review-results.json`, `pin-trust-live-exclusions.json` | Trust verdicts + live exclusions |
| `audit-all-water-pins.js` | Primary cscript water-pin audit (hard gates onshore scans) |
| `scan-fish-onshore.js`, `scan-dive-onshore.js` | Hard-gate onshore scanners |
| `location-audit-core.js`, `coast-audit-sanitize.js` | Shared audit helpers |
| `audit-map-water-pins.js` | Advisory map-water audit |
| `audit-dive-sites.js`, `audit-all-locations.js` | Legacy / supplemental audits |
| `ais-relay.mjs` | Local WebSocket proxy for AISStream (browsers often blocked direct) |
| `fetch-coast.mjs`, `regenerate-coast.ps1`, `process-coast.ps1` | Rebuild audit `coast-geo.js` from OSM (not the map overlay) |
| `coast-osm.json`, `overpass-query.txt`, `coast-osm-ways.js` | OSM coastline cache + WSH extract for overlay builder |
| `socal-dive-conditions.html` | Original dive conditions page — **do not edit**; BoatBoard is separate |
| `package.json` | `ws` dependency for AIS relay only |
| `README.md`, `PROJECT.md`, `CONVERSATION.md`, `CONTEXT.md` | Project docs (this file set) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  index.html (shell + most business logic)    │
│  ├── GPS toggle / slip snap / boatPos()                     │
│  ├── Forecast fetch + localStorage cache                    │
│  ├── Leaflet maps (AIS, swell, fish, surf, MPA, SST, chl) │
│  ├── Cruise tab → Windy waves iframe                        │
│  ├── Underway heading-up satellite radar (canvas + SVG)     │
│  ├── AIS display state (shared AIS + Underway)              │
│  └── Tab router + refresh timers                            │
├─────────────────────────────────────────────────────────────┤
│  dive-engine.js  → window.BoatDive (init, rank, maps)       │
│  dive-briefings-data.js → window.__BOAT_DIVE_BRIEFINGS__     │
│  seafloor-render.js → window.SeafloorRender                 │
│  coast-overlay-lite.js → window.COAST_OVERLAY_LITE (maps)   │
│  coast-geo.js    → window.COAST_GEO (audit tools only)      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Open-Meteo API      NOAA / NWS / NDBC      CDFW ArcGIS
   AISStream (+relay)  CoastWatch ERDDAP      Windy.com embed
                       Esri imagery tiles
```

- **No build step** for the dashboard itself — open `index.html` in a browser (`file://` works for most features).
- **Settings** (AIS key, relay URL, slip override, GPS toggle) persist in `localStorage`.
- **Forecast cache** keys under `boatCache:*` survive brief offline periods.

## Tabs and features

Nav order: **Overview · Underway · Swell & Ocean · Plankton · Temperature · Cruise · Surf · Wildlife · AIS · Weather · Tides · Fish · Dive**

### Overview
At-a-glance cards: GPS/slip status, travel heading, effective seas, tide, weather snippet, top dive/fish picks, plankton/wildlife takeaways, quick links to NOAA/CDFW.

**Use device GPS** (`#togUseGps` / Settings `#togUseGpsSettings`): when off, position is slip or manual lat/lon — not live device GPS.

### Underway
Heading-up **satellite radar** (Esri World Imagery canvas + SVG overlay) combining:
- **Satellite background** — inverse log-scaled polar mapping (`uwRadarXYToLatLon`, `uwDistToRadius`); triple-tier tile zoom (outer / inner 68% / core 28%); DPR-aware canvas with 1280px cap; tile cache + bitmap cache; **canvas reused** on AIS refresh (SVG overlay only replaced)
- Model swell rays (shadow-adjusted) relative to bow
- **AIS contacts** — same dual-marker convention as AIS tab (see below); log-scaled distance
- **Recommended comfort headings** — all **5** picks drawn on radar as wedges + spokes extending **~28px past** satellite edge; degree labels outside circle; full list in collapsible `<details>` below radar
- **Zoom**: 0.6–12 nm via +/- buttons, scroll, pinch; default 6 nm
- **Full-screen square radar** — `fitUwRadar()` sizes `#uwRadar` to max square in viewport; compact floating heading bar + zoom pill; swell/traffic/rec headings in scrollable `.uw-details` below

Separate **AIS** and **Swell & Ocean** tabs remain for dedicated views.

### Swell & Ocean (combined former Marine + CDIP)
- Left: heading-up compass with swell breakdown (degrees + cardinal, bow-relative labels)
- Right: north-up Leaflet map at boat position with model swell rays, CDIP buoy **vector lines** (Hs dots removed), range rings
- Below: swell component cards, shadow detail, NWS + model + buoy **ocean summary**
- Swell energy index: **kJ = H² × T** (H in ft, T in s — proportional index, not SI flux)
- Map `minZoom` lowered (regional view); buoy markers are directional arrows, not circles

### Plankton
CoastWatch / ERDDAP chlorophyll-a WMS overlays (JSONP-friendly for `file://`). Map + point samples feed Overview marine-life takeaways. CDPH harvest advisories remain operator responsibility.

### Temperature
CoastWatch SST WMS layers (1-day / 3-day / MUR / Blended). Legacy `erdGHssta*` retired. Map centered on boat; metadata/cache under `boatCache:*`.

### Cruise
Relaxed cruising / anchor planning — **Windy.com primary map** (custom vector field removed Jul 23 evening):

- **Glance cards** — shadow-adjusted effective seas at boat, calmest sector (label + bearing), wind speed/direction
- **Full-width Windy embed** (`#cruiseWindyEmbed`) — waves overlay, boat marker, centered on `boatPos()`; updates when position changes (0.01° lat/lon debounce)
- **Sector comfort table** — 8 directions; effective seas sampled **5 nm ahead** (`CRUISE_SECTOR_SAMPLE_NM`); land-blocked sectors marked; comfort score 0–100
- **Shadow detail** — per-component swell at boat with `shadowFactor()` notes

**Windy hosts:**
- **`file://` parent** — `embed.windy.com` **embed2** (waves). `embed2` has no `metricWave` URL param; wave height may follow **GeoIP** (often meters). Prefer an http(s) host for locked feet.
- **http(s) parent** — `windy-waves-embed.html` Map Forecast API host with `metric_waves=ft` / store lock to feet.
- Cache bust: `CRUISE_WINDY_EMBED_VER` (**10**) as `_v=` on embed URLs.

**Removed** (Jul 23, after persistent vector bugs):
- Custom Leaflet cruise map (`#cruiseMap`)
- `CruiseFieldCanvas` canvas vector field (~600 lines of grid/land-mask/arrow code)
- Water route sub-tab, lee corridor shading, navigation guidance text
- Anchor pin scoring / explicit relax spots

**Why Windy replaced custom map:** Multiple iterations of client-side swell arrows failed on land clipping, partial render, performance, and **direction convention** (90°/180° mismatches vs Swell & Ocean tab). User directive: *"Let's just replace this whole map with the windy.com one."*

### Surf
Curated SoCal breaks ranked from Open-Meteo marine swell + land shadowing + spot exposure + wind. Map with color-rated pins; not a Surfline scrape.

### Wildlife
Seasonal / sighting intel (embeds + optional API fetches). Live sighting APIs often block CORS from `file://` — seasonal intel and embeds remain usable.

### AIS
North-up Leaflet map centered on boat; nearby vessels from AISStream subscription.

**Vessel markers** (shared logic with Underway via `aisDisplayState()` and helpers):

| Vessel state | Report position | Propagated (DR) position |
|--------------|-----------------|--------------------------|
| **Underway** (SOG ≥ 0.8 kn + course) | Small solid dot (`AIS_REPORT_DOT_R` = 2.5px) | Solid triangle (`AIS_DR_TRI_HALF` = 11px) at dead-reckoned position |
| **Stationary / slow** | — | Large solid dot (`AIS_STATIONARY_DOT_PX` = 14px) at report |

- Dashed connector line report → DR for underway vessels
- Dashed course ahead with hollow dots at **4, 8, 12 minutes** at current SOG/COG (`AIS_FUTURE_MINS`)
- **Age color tiers** (legend on mapbar):
  - **Fresh** — green, `<1 min` since last AIS report (`AIS_FRESH_SEC` = 60)
  - **Aging** — yellow, `1–3 min` (`AIS_AGING_SEC` = 180)
  - **Stale** — orange, `3–10 min` (`AIS_OLD_SEC` = 600)
  - **Very stale** — red, `>10 min`
- DR projection applies to **all underway vessels** (not only when stale); `drActive` when SOG + course available
- Popups include `aisAgeTierLabel()` text

Legend line: *"▸ dashed course (4, 8, 12 min at speed)"*

### Weather
Open-Meteo hourly forecast:
- Hero card (air + feels-like temps, wind, humidity, UV when day)
- **What to wear** comfort tips
- 5-day daily outlook cards
- **48-hour stacked chart** (`renderWxStackedChart`) — **four panels, shared x-axis, full width**:
  1. Temperature (air + feels-like)
  2. Wind (sustained + gusts)
  3. Rain probability (%)
  4. UV index
- **Day/night bands** — base `WX_C.day` fill, then darker `WX_C.night` rectangles between sunset and sunrise
- **Sunrise/sunset** — gray dashed vertical lines (`WX_C.sunMarker` = `#7a8a9a`), ↑/↓ time labels
- Distinct `CHART` / `WX_C` palette (no orange overload)
- Next 24 hours hourly table

### Tides
NOAA predictions for station **9410738** (King Harbor); multi-day tide curve with all highs/lows marked.

### Fish
Subtabs:
- **Plan** — date/time picker (shared calendar modal), ranked spots, comfort+swell synthesis, map
- **On site** — spot picker, tactics, solunar/tide windows, seafloor render
- **MPA map** — CDFW South Coast MPAs (GeoJSON), tap for rules; cached locally

**Live counts (Jul 29, 2026):** **552** `FISH_SPOTS` — verified 55 · kml 413 · cdfg 126 · userTrusted 438 (flags overlap). GPS coords shown in list/popups via `fmtFishCoordsDepth`.

Map auto-fit / ranking radius: **`FISH_MAP_FIT_NM` = 10**. Ranked picker pool: **`FISH_PICKER_POOL` = 25**.

### Dive
Subtabs:
- **Plan** — calendar date, ranked sites (shared **25**-site picker pool), map with numbered markers, 5-day outlook, factors; GPS + depth in list
- **On site** — nearest-site dropdown, **pre-dive briefing**, site guide, seafloor bathymetry/kelp

**Live counts (Jul 29, 2026):** **358** `DIVE_SITES` — verified 57 · kml 134 · cdfg 190 · userTrusted 358. `siteMapPos()` uses raw water-side GPS (no runtime `mapDisplayPos` push).

Map auto-fit / ranking radius: **`DIVE_MAP_FIT_NM` = 10**. Ranked picker pool: **`SITE_PICKER_POOL` = 25**.

**Pre-dive briefings** (On site tab):
- Data in `dive-briefings-data.js` → loaded as `window.__BOAT_DIVE_BRIEFINGS__`
- Typical structure:
  1. *Why dive here* — character, geology, best conditions
  2. *Navigation, POIs & hazards* — entry, depth zones, traffic, MPA, hazards
  3. *Marine life by zone* — species by depth, seasonal patterns, behavior
- Rendered by `renderDiveBriefing()` with `.dive-briefing-h` subheadings
- Mobile: scrollable prose (`max-height: min(70vh, 640px)`)

## Water-pin GPS policy (never nudge)

Displayed fish/dive pins use **published GPS only**. Do **not** nudge, mega-push, or run fix scripts to silence audits.

**Default-trusted** (no pin-trust “yes” required):

1. `verified-water-pins.json` (≥2 independent sources within ~0.2 NM) → `verified: true`  
   - Log sizes (Jul 29, 2026): **fishKept 49**, **diveKept 57**
2. CDFG Artificial Reef Appendix → `cdfgAppendix: true` (`cdfg-artificial-reefs.json`)
3. `San Diego Fishing Spots.kml` → `kmlImported: true`

**User no / unsure** in `pin-trust-review-results.json` (applied by `apply-pin-trust-yes.js`) **overrides** the above. Other confirmed yes verdicts → `userTrusted: true`.

**Pin-trust summary (Jul 29, 2026):** yes **801** · no **8** · unsure **7** · pending **0**.

### Pin-trust review workflow

```text
cscript //Nologo build-pin-trust-review.js   # → pin-trust-review-data.js
open pin-trust-review.html                   # yes / no / unsure on imagery
# export → pin-trust-review-results.json
cscript //Nologo apply-pin-trust-yes.js      # stamp / omit live lists
```

Related: `pin-trust-live-exclusions.json`, `auto-seed-default-trust-yes.cjs`, `sync-verified-pins-live.cjs`.

Full enforceable rules: `.cursor/rules/water-pin-coords.mdc`.

## Maps (Leaflet)

- **Library**: Leaflet 1.9.4 (CDN, lazy-loaded via `loadLeaflet()`)
- **Base tiles**: Esri **World Imagery** (satellite); auto-fallback to World Topo after tile errors
- **Theme**: `.ocean-map-dark` — dark background, slight brightness/contrast filter, gradient overlay
- **Coast overlay**: Port Royal slip pin (yellow); breakwater/channel dashed lines **removed** from map overlay (GPS logic retains harbor polygons)
- **Maps using base layer**: dive plan, fish plan, fish MPA, surf, swell, AIS, SST, plankton
- **Cruise tab**: Windy iframe only (no Leaflet)
- **Underway tab**: Esri tiles sampled into circular canvas (not Leaflet)

### Seafloor (On site — dive & fish)
`SeafloorRender` in `seafloor-render.js`:
- **Primary bathy**: Open Waters Seascape Terrarium tiles (`tiles.openwaters.io/seascape`)
- **Fallback**: NOAA ERDDAP SRTM30+/ETOPO gradient grids
- **Kelp**: CDFW ArcGIS FeatureServer `biosds3135_fpu`
- Renders depth contours, kelp polygons, dark blue-gray palette; probe on tap

## Data sources

| Data | Source | Refresh |
|------|--------|---------|
| Marine swell/wind waves | `marine-api.open-meteo.com` | ~3 min |
| Surface weather + UV | `api.open-meteo.com` | ~10 min |
| Tides | NOAA CO-OPS `9410738` | ~15 min |
| NWS surf zone text | `api.weather.gov` SRF LOX | ~10 min |
| Buoy observations | NDBC realtime `.txt` + Open-Meteo at buoy lat/lon | ~15 min |
| MPAs | CDFW ArcGIS MarineProtectedAreas_WebMer (SCSR) | 90-day cache |
| AIS | AISStream WebSocket (direct or `ais-relay.mjs`) | live |
| Coastline / shadow | `coast-overlay-lite.js` (OSM) + runtime `OBSTACLES` | static |
| Bathymetry | Open Waters + ERDDAP | 8 min cache |
| SST / chlorophyll | CoastWatch ERDDAP WMS (+ JSONP where needed) | tab/cache |
| Cruise swell map | Windy embed (waves) | live iframe |
| Underway radar imagery | Esri World Imagery tiles (same URL as plan maps) | cached per view |

## Geo and coordinate handling

### Home slip (Port Royal)
```javascript
// 33°50'53.4"N 118°23'46.8"W — full DMS precision
SLIP_LAT = 33 + 50/60 + 53.4/3600   // 33.8481666667
SLIP_LON = -(118 + 23/60 + 46.8/3600) // -118.3963333333
```

### GPS → boat position
- **Use device GPS** toggle (`togUseGps`): off → slip or manual; on → device GPS path below
- `resolveGpsPosition()`: when slow (< 2.5 kn) and on land / near slip (< 1200 m) / not on water → **snap to slip**
- `boatPos()`: returns slip when snapped or device on land; else live GPS
- Speed jitter: `GPS_SOG_DEAD_KN = 0.4`, min movement `GPS_SOG_MIN_DIST_M = 6` scaled by GPS accuracy
- Heading: device compass when available; COG when speed ≥ 1.5 kn

### Land / water detection
- `coast-geo.js` polylines + island polygons
- `KING_HARBOR_LAND`, `KING_HARBOR_BBOX`, `CRUISE_HARBOR_WATER_BBOX` for harbor detail
- `isOnLand()`, `isLikelyOnWater()`, `metersEastOfShoreline()`, `localEastM()` (nearest segment normal)
- `shadowFactor()` — ray-cast swell from direction against islands/peninsulas
- **COAST_GEO gaps**: Orange County and San Diego coast lack full mainland lines; explicit gap exceptions in validation

### Curated site coordinates
- Stored at **6–7 decimal places** (~0.1 m)
- Dive/fish map pins: **water-side targets**, not beach parking (sources: USC Sea Grant, CDFW, PADI, diver.net, NDBC, KML, CDFG appendix, multi-source verify)
- **`mapDisplayPos()` auto-push removed** for dive and fish markers (root cause of repeated “sites on wrong location” bugs)
- `siteMapPos()` / `fishMapPos()` return stored coords; optional explicit `mapOffshoreM` only when entry stored as bluff
- Boot validation: `validateAllLocationCoords()` / `validateDiveSiteCoords()` warn on land coords

**Jul 24 location audit** (historical scrub after Honeymoon Cove report):
- **Honeymoon Cove** → `33.7638000, -118.4258000` (kelp west of Paseo Del Mar entry; diver.net Merry's Reef reference)
- **Neptune's Cove (Golden Cove)** → `33.7512667, -118.4178333` (diver.net Underwater Arch / Calle Entradero)
- **Malaga Cove** → `33.8042000, -118.4015000` (~200 m west of Via Arroyo entry; not RAT Beach)
- Portfolio later expanded via KML / CDFG / verified / pin-trust — **do not use Jul 24 totals (209/244) as current**; see live counts above.

### Audit scripts

Primary (after any location edit):

```text
cscript //Nologo audit-all-water-pins.js
```

Hard gates (must exit 0): `scan-fish-onshore.js`, `scan-dive-onshore.js`.  
Advisory: `audit-map-water-pins.js`. Shared helpers: `location-audit-core.js`, `coast-audit-sanitize.js`.

Legacy / supplemental:

```bash
node audit-all-locations.js
cscript //Nologo audit-dive-sites.js
```

**Do not** use nudge / mega-push / `fix-map-water-pins` / `apply-pv-water-fix` to pass audits — replace coords from published sources or omit the pin.

Re-run after any coordinate edit. Committed JSON may lag behind source arrays.

## Performance optimizations

| Area | Technique |
|------|-----------|
| Forecast | Staggered refresh intervals; cache in localStorage |
| Leaflet | Lazy init per tab; `invalidateSize` on tab show / orientation change |
| Underway | Canvas bitmap cache; reuse canvas on AIS tick; step-2 pixel fill when >1.5M px; SVG-only overlay refresh |
| Cruise | Windy iframe (lazy `src`); no canvas/grid compute; sector table only uses model math |
| Weather | Single SVG stacked chart; width from container |
| Seafloor | Tile + ERDDAP cache; 55 s fetch timeout |
| SST / chl | WMS + ERDDAP JSONP; `boatCache:*` metadata |
| Coast segments | `_coastSegsCache` memoization |
| AIS | Bbox filter ~0.55°; prune stale contacts; shared `aisDisplayState()` |
| Dive briefings | External `dive-briefings-data.js` — keeps `dive-engine.js` smaller |

## AIS relay

AISStream often blocks browser WebSockets. Run on boat LAN:

```bash
npm install
node ais-relay.mjs YOUR_AISSTREAM_API_KEY
# Tablet Settings → AIS relay URL: ws://LAPTOP_IP:8765
```

## Known fixes (historical)

- Tab switching blocked by overlay z-index → fixed touch targets and panel visibility
- NWS HTTP 400 → corrected gridpoint/coordinates for SoCal
- AIS Blob parse error → proper WebSocket binary handling; relay fallback
- Dive tab reformatted; closest-10 dropdown; log dive removed
- Marine tab summary moved above raw NWS text
- Weather chart scaling/orange overload → distinct CHART palette; stacked 4-panel layout with day/night bands
- Fishing map world view → local default zoom
- Slip snap blob / wrong harbor overlay → removed visual water polygon; precise slip coords
- Shoreline accuracy → OSM coast regen with PV cove detail
- Seafloor `Failed to fetch` / `line.filter` → Open Waters tiles + coast line format fix
- Speed when stationary → SOG deadband + accuracy-aware distance threshold
- Dark seafloor → black/blue/gray contours; then satellite base for plan maps
- Stray dashed lines near slip → removed breakwater/channel from `addCoastOverlay`
- Dive plan/on-site pool sync → shared picker pool (now **25**; was 22)
- Sacred Cove on land → USC Sea Grant kelp reef water coords; LA basin dive sites audited
- Fish expanded; Shoemaker → outer harbor water; `fmtFishCoordsDepth`
- **Cruise custom vector field** → removed after repeated land/direction/performance failures; replaced with Windy ECMWF embed
- **Pre-dive briefings** → external data file; 3× expanded detail per site
- **Underway shoreline outlines** → replaced with Esri satellite canvas (Jul 23 evening)
- **Underway satellite blank** → canvas reuse on AIS refresh; render size cap; triple-tier zoom
- **AIS underway markers** → dual-marker DR for all moving vessels; clarified age tiers and legend (Jul 24)
- **Location portfolio** → Jul 24 scrub (209/244) later superseded by KML/CDFG/verified/pin-trust expansion (552 fish / 358 dive as of Jul 29, 2026)
- **GPS toggle** → Use device GPS in Overview/Settings
- **Map fit / picker defaults** → 10 nmi fit, 25-spot pools
- **Windy feet** → Map Forecast host on http(s); embed2 caveat on `file://`

## Running

1. Open or serve **`index.html`** (GitHub Pages / HTTPS preferred for geolocation, tiles, and Windy **ft** lock).
2. Allow GPS, or turn **Use device GPS** off and use slip / manual; on land with GPS on the app uses **slip** automatically when snapped.
3. Enter AISStream key in Settings (and relay URL if needed).
4. Run `cscript //Nologo audit-all-water-pins.js` after editing coordinate arrays.
5. Cruise tab requires network access to `embed.windy.com` (and Map Forecast API when served over http(s)).
6. Hard-refresh after bumping `CRUISE_WINDY_EMBED_VER` / embed host changes.

## GitHub Pages

| Item | Path / value |
|------|----------------|
| Site entry | `index.html` |
| Legacy redirect | `socal-boat-dashboard.html` → `index.html` |
| Disable Jekyll | `.nojekyll` |
| Deploy workflow | `.github/workflows/pages.yml` (push to `main`/`master`) |
| Public URL | `https://mikelee1991-del.github.io/boatboard/` |

Enable Pages: **Settings → Pages → Source = GitHub Actions** (or branch `/` root). No build step; artifact is the repo root.

Remote: `https://github.com/mikelee1991-del/boatboard`
