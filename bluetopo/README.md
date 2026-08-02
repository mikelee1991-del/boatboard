# BlueTopo for BoatBoard

Self-host (or stream) **real NOAA BlueTopo** seafloor relief. Depths are never invented — only NOAA NBS BlueTopo (and NCEI DEM underlay on On site where BlueTopo cells are not delivered yet).

## Split basemap (AIS · fish ranked · dive ranked)

`split-basemap.js` **v2** stacks **Esri World Imagery** under a **masked** water stack (NCEI DEM + BlueTopo WMTS).

**Prior failure (`207e5ee`):** a 90 km landward extrude from every coast segment painted most of the ocean as “land”, and the CSS mask used luminance while the canvas was opaque black/white (alpha≈1 everywhere). Result: BlueTopo was clipped away → maps looked like imagery-only.

**Fix:** alpha mask (opaque = water layers, transparent = land) + east-of-shoreline row punch + islands/inland boxes. DEM underlay keeps water distinct even where BlueTopo cells are undelivered (King Harbor).

Wire-up: `planMapBaseLayer(map, { splitBlueTopo: true })` after `ensureBlueTopoSplitLib()`.

**Limits:** Mask follows the ~100 ft visual coast overlay (not survey-grade). Peninsulas west of the easternmost shoreline at a lat can briefly show water layers on land. No Google Maps tiles in-repo (needs API key) — Esri World Imagery is the land layer. Not for navigation.

## On site architecture

```
Phone (GH Pages BoatBoard)
  └─ seafloor-render.js
        ├─ default: NCEI DEM underlay
        │     + nowCOAST BlueTopo hillshade WMTS (transparent where undelivered)
        └─ optional: self-hosted PMTiles (config.pmtilesUrl)
              └─ Cloudflare R2 ← Worker (CORS + HTTP Range)
                    ← Docker/GHA build from NOAA S3 GeoTIFFs
```

| Host | Role |
|------|------|
| **nowCOAST WMTS** (default, no deploy) | Live BlueTopo hillshade; CORS `*`; empty SoCal cells are transparent PNGs |
| **Cloudflare R2 + Worker** (recommended for PMTiles) | Same one-time pattern as `ais-relay-worker/`; free-tier friendly; Range requests |
| **GitHub Releases** | OK for a smoke `.pmtiles` (&lt; ~2 GB soft); do **not** commit multi‑GB GeoTIFFs to the repo |
| **GitHub Pages** | Soft ~1 GB repo limit — fine for `config.json` + scripts only, not full day-trip rasters |

## AOIs

| File | Box (approx) | Notes |
|------|----------------|-------|
| `aoi-smoke-palosverdes.geojson` | −118.36…−118.12, 33.68…33.80 | Delivered 2 m UTM 11 samples (PV / San Pedro) |
| `aoi-socal-daytrip.geojson` | −118.65…−117.90, 33.25…34.10 | King Harbor / PV / Catalina-ish day-trip |

**Coverage honesty (checked 2026-08):** tile scheme includes SoCal, but many cells are **not delivered** on S3 yet — including King Harbor (`BH46G5B7`). Palos Verdes / San Pedro has real GeoTIFFs. WMTS matches that mosaic (transparent over KH; solid over PV).

Scheme index (do not commit):  
`s3://noaa-ocs-nationalbathymetry-pds/BlueTopo/_BlueTopo_Tile_Scheme/BlueTopo_Tile_Scheme_*.gpkg`

## On site UI

- Layer name: **BlueTopo relief**
- Default for Fish + Dive On site (`preferDem: true`): DEM + BlueTopo hillshade group
- Plan stays Esri Ocean unless you point `pmtilesUrl` at a cheap host and flip Plan later
- Toggles still include NCEI DEM alone, NOAA ENC, Ocean chart, Satellite

## Live path (no tile build)

1. Ship this repo — `bluetopo/config.json` has empty `pmtilesUrl` and `wmtsEnabled: true`.
2. Hard-refresh BoatBoard → Fish / Dive → **On site**.
3. Layers control → **BlueTopo relief**. Around PV you should see NOAA BlueTopo hillshade; at King Harbor you still see NCEI DEM through transparent BlueTopo tiles.
4. On phone: same URL as Pages; pinch-zoom; confirm attribution mentions BlueTopo / NCEI.

## Self-host PMTiles (Docker)

Needs Docker Desktop (or any Docker host). This Windows checkout often has **no** local GDAL/Python — use Docker or the workflow below.

```bash
cd bluetopo
docker build -t boatboard-bluetopo .
mkdir out
docker run --rm -v "%CD%/out:/out" boatboard-bluetopo smoke
# optional larger AOI (may be large / sparse):
docker run --rm -v "%CD%/out:/out" boatboard-bluetopo daytrip
```

Output: `out/bluetopo-smoke-palosverdes.pmtiles` + `MANIFEST-*.txt`.

### Upload to Cloudflare R2 + Worker

```bash
cd bluetopo/worker
npm i
npx wrangler login
npx wrangler r2 bucket create boatboard-bluetopo
npx wrangler r2 object put boatboard-bluetopo/bluetopo-smoke-palosverdes.pmtiles --file=../out/bluetopo-smoke-palosverdes.pmtiles --content-type application/octet-stream
npx wrangler deploy
```

Wrangler prints `https://boatboard-bluetopo-tiles.<you>.workers.dev`. Then edit `bluetopo/config.json`:

```json
{
  "pmtilesUrl": "https://boatboard-bluetopo-tiles.<you>.workers.dev/bluetopo-smoke-palosverdes.pmtiles",
  "wmtsEnabled": true,
  "layerLabel": "BlueTopo relief"
}
```

Commit the config URL only (not the `.pmtiles` binary).

### GitHub Actions (manual)

Workflow: `.github/workflows/bluetopo-tiles.yml` — **workflow_dispatch**, builds smoke AOI, uploads a Release asset. Use that asset URL as `pmtilesUrl` if you skip R2.

## Rebuild / update

1. Re-run Docker or Actions when NOAA publishes new SoCal tiles (monthly-ish where active).
2. Re-upload R2 object (same key) or cut a new Release.
3. Bump a cache-buster query on `pmtilesUrl` if browsers stick to an old ETag (`?v=2026-08-01`).

## Attribution

Acknowledge NOAA Office of Coast Survey **BlueTopo** / National Bathymetric Source. Not for navigation.

## Limits

- Undelivered scheme cells → no GeoTIFF / transparent WMTS; DEM underlay fills the gap visually (different product).
- Full day-trip AOI PMTiles can exceed GH Pages comfort — prefer R2.
- Hillshade is a **visualization** of real elevations; numeric depths for decisions still belong on a plotter / ENC.
