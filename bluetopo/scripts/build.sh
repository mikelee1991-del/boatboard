#!/usr/bin/env bash
# Fetch NOAA BlueTopo GeoTIFFs for an AOI → hillshade RGB → MBTiles → PMTiles.
# Usage (Docker): build.sh [smoke|daytrip]
# Writes /out/bluetopo-<aoi>.pmtiles and a small MANIFEST.txt
set -euo pipefail

AOI_NAME="${1:-${AOI:-smoke}}"
OUT_DIR="${OUT_DIR:-/out}"
WORK="${WORK_DIR:-/work/data}"
mkdir -p "$WORK" "$OUT_DIR"

case "$AOI_NAME" in
  smoke|pv|palosverdes)
    GEO="/work/aoi-smoke-palosverdes.geojson"
    LABEL="smoke-palosverdes"
    MINZ=10
    MAXZ=16
    ;;
  daytrip|socal|*)
    GEO="/work/aoi-socal-daytrip.geojson"
    LABEL="socal-daytrip"
    MINZ=9
    MAXZ=15
    ;;
esac

echo "== BlueTopo build: $LABEL =="
echo "Geometry: $GEO"
echo "Out: $OUT_DIR"

PROJECT="$WORK/$LABEL"
mkdir -p "$PROJECT"

echo "== Fetch BlueTopo tiles (delivered cells only) =="
# nbs discovers tiles from the public NOAA S3 bucket; skips undelivered scheme cells.
nbs fetch -d "$PROJECT" -g "$GEO" -s bluetopo || {
  echo "nbs fetch failed — check network / noaabathymetry install" >&2
  exit 1
}

echo "== Mosaic per UTM zone =="
nbs mosaic -d "$PROJECT" -s bluetopo || true

# Prefer mosaicked VRTs/TIFFs under project; fall back to raw tile TIFs.
mapfile -t RASTERS < <(find "$PROJECT" -type f \( -iname '*.vrt' -o -iname '*mosaic*.tif' -o -iname '*mosaic*.tiff' \) 2>/dev/null | sort)
if [[ ${#RASTERS[@]} -eq 0 ]]; then
  mapfile -t RASTERS < <(find "$PROJECT" -type f \( -iname 'BlueTopo_*.tif' -o -iname 'BlueTopo_*.tiff' \) 2>/dev/null | sort)
fi
if [[ ${#RASTERS[@]} -eq 0 ]]; then
  echo "No BlueTopo rasters downloaded for this AOI (NOAA may not have delivered cells yet)." >&2
  echo "King Harbor is often undelivered; try smoke (Palos Verdes) AOI." >&2
  exit 2
fi

echo "Found ${#RASTERS[@]} raster(s)"
VRT="$WORK/${LABEL}.vrt"
gdalbuildvrt -overwrite "$VRT" "${RASTERS[@]}"

# Elevation is band 1 (meters, typically negative below MLLW/other NBS datum).
ELEV="$WORK/${LABEL}_elev.tif"
echo "== Extract elevation band =="
gdal_translate -b 1 -co COMPRESS=DEFLATE -co TILED=YES "$VRT" "$ELEV"

HS="$WORK/${LABEL}_hillshade.tif"
echo "== Hillshade (visual relief only — depths remain in source GeoTIFF) =="
gdaldem hillshade "$ELEV" "$HS" -z 2 -s 1 -az 315 -alt 45 -compute_edges

MBTILES="$WORK/${LABEL}.mbtiles"
echo "== RGB tiles → MBTiles (z${MINZ}–${MAXZ}) =="
rm -f "$MBTILES"
# Warp to Web Mercator for standard XYZ / PMTiles.
WGS="$WORK/${LABEL}_hs_3857.tif"
gdalwarp -t_srs EPSG:3857 -r bilinear -co COMPRESS=DEFLATE -co TILED=YES "$HS" "$WGS"
gdal_translate -of MBTILES -co "TILE_FORMAT=PNG" -co "ZOOM_LEVEL_STRATEGY=AUTO" \
  "$WGS" "$MBTILES"
# Restrict zoom if gdal created a wider pyramid (best-effort).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$MBTILES" "DELETE FROM tiles WHERE zoom_level < $MINZ OR zoom_level > $MAXZ;" || true
  sqlite3 "$MBTILES" "UPDATE metadata SET value='$MINZ' WHERE name='minzoom';" || true
  sqlite3 "$MBTILES" "UPDATE metadata SET value='$MAXZ' WHERE name='maxzoom';" || true
fi

PMTILES="$OUT_DIR/bluetopo-${LABEL}.pmtiles"
echo "== Convert → PMTiles =="
pmtiles convert "$MBTILES" "$PMTILES"

{
  echo "label=$LABEL"
  echo "built=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source=NOAA BlueTopo (NBS) via noaabathymetry"
  echo "aoi_geojson=$(basename "$GEO")"
  echo "rasters=${#RASTERS[@]}"
  echo "pmtiles=$(basename "$PMTILES")"
  echo "bytes=$(wc -c < "$PMTILES" | tr -d ' ')"
  echo "zooms=${MINZ}-${MAXZ}"
  echo "note=Hillshade is a visualization of real BlueTopo elevations — not invented depths."
} | tee "$OUT_DIR/MANIFEST-${LABEL}.txt"

ls -lh "$PMTILES"
echo "Done. Host $PMTILES on R2 / GitHub Release (not GH Pages if large), then set bluetopo/config.json pmtilesUrl."
