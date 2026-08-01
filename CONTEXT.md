# BoatBoard — Compressed context

Read this first in a new session. Details: `README.md`, `PROJECT.md`, `.cursor/rules/water-pin-coords.mdc`.

## North star

Tablet/phone **BoatBoard** for a boat at **Port Royal, King Harbor** (33.84817, −118.39633). SoCal fishing, diving, cruising, swell-aware nav. Primary entry: **`index.html`** (+ `dive-engine.js`) — local **`file://`** or **GitHub Pages** (`https://mikelee1991-del.github.io/boatboard/`). Dark, mobile-first. No onboard AIS TX — device GPS + AISStream via **`ais-relay.mjs` + wss tunnel** on phone/HTTPS (see README “How to connect AIS on phone”; in-app **AIS → Setup help**). Legacy `socal-boat-dashboard.html` redirects to `index.html`.

## Trust policy (non-negotiable)

**Never nudge** fish/dive coordinates. Display only published GPS.

Default-trusted (no pin-trust yes required):

- `verified-water-pins.json` (≥2 sources ≤~0.2 NM) → `verified: true`
- CDFG appendix (`cdfg-artificial-reefs.json`) → `cdfgAppendix: true`
- `San Diego Fishing Spots.kml` → `kmlImported: true`

**User no/unsure** (`pin-trust-review-results.json` → `apply-pin-trust-yes.js`) overrides the above. Other yes verdicts → `userTrusted: true`.

Review UI: `pin-trust-review.html` (build with `build-pin-trust-review.js`).

## Live counts (Jul 29, 2026)

- **FISH_SPOTS: 552** (verified 55 / kml 413 / cdfg 126 / userTrusted 438 — flags overlap)
- **DIVE_SITES: 358** (verified 57 / kml 134 / cdfg 190 / userTrusted 358)
- verified log: fishKept 49, diveKept 57
- pin-trust: yes 801 · no 8 · unsure 7 · pending 0

## Current defaults / caveats

- Map fit: **`FISH_MAP_FIT_NM` = `DIVE_MAP_FIT_NM` = 10** nmi
- Picker pools: fish/dive **25**
- Cruise Windy: overlay **`waves`**; feet via Map Forecast `metric_waves` in `windy-waves-embed.html`. **GitHub Pages / http(s)** uses that path (ft locked). On **`file://`**, parent uses **embed2** — wave height may still follow **GeoIP**. Cache bust: `CRUISE_WINDY_EMBED_VER` (**10**).
- Deploy: `.github/workflows/pages.yml` + `.nojekyll`; see README “GitHub Pages deploy”.
- Swell energy: **kJ = H² × T** (H ft, T s)
- GPS toggle: Overview/Settings **Use device GPS**; off → slip or manual
- Tide station: NOAA **9410738**
- Audits: `cscript //Nologo audit-all-water-pins.js` (hard gates: fish+dive onshore scans). Do **not** use nudge/fix scripts to pass audits.
- Hard-refresh after bumping `_v=` / embed host changes

## Touch these files

| Path | When |
|------|------|
| `index.html` | UI, fish, weather, cruise, SST, GPS |
| `dive-engine.js` | Dive sites / scoring / maps |
| `windy-waves-embed.html` | Cruise ft lock |
| `verified-water-pins.json` + sync scripts | Multi-source pins |
| `pin-trust-review*.json/js/html` | Trust review pipeline |

Do not edit `socal-dive-conditions.html`. Do not commit unless asked.
