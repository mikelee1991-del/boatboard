'use strict';
/*
 * On-site bathymetry chart (Fish + Dive + Fish Plan) — Leaflet.
 *
 * Tile sources (attribution on the map control):
 *   1. BlueTopo relief (default On site when preferDem) — real NOAA NBS BlueTopo
 *      hillshade via nowCOAST WMTS, optionally self-hosted PMTiles (bluetopo/config.json).
 *      Stacked over NCEI DEM; undelivered BlueTopo cells are transparent PNGs.
 *   2. NOAA NCEI DEM ColorHillshade — coastal mosaic underlay / solo toggle.
 *   3. NOAA ENC Online WMS — chart soundings / schematic symbols.
 *   4. Esri World Ocean Base + Reference — regional tint (Plan default).
 *   5. OpenSeaMap seamarks · Esri World Imagery · CDFW kelp GeoJSON.
 *   6. Depth isolines (ft) — NCEI elevations, toggleable overlay (cyan minor / yellow major).
 *
 * Self-host pipeline: bluetopo/README.md (Docker → PMTiles → R2 Worker).
 *
 * Fit: On site + Plan default ~10 nmi radius (ONSITE_FIT_NM / PLAN_FIT_NM).
 * Overlay: fishing-style depth isolines (ft) via NCEI getSamples + marching squares.
 * DEM: tiled overview, then viewport-matched NCEI export at z≥14 (screen pixels, not stretched tiles).
 * BlueTopo WMTS is native through z20 (512px tiles); SoCal cells are often empty → DEM shows through.
 * NCEI source cells are ~3 m — beyond that we smooth, we cannot invent survey detail.
 * Not for navigation.
 */

(function (global) {
  const D2R = Math.PI / 180;
  const FT_PER_NM = 6076.12;
  /** On site + Plan default fit radius (~10 nmi view span). */
  const ONSITE_FIT_NM = 10;
  const ONSITE_FIT_FT = Math.round(ONSITE_FIT_NM * FT_PER_NM);
  /** Nearby reef/kelp/rock pins — a bit under the fit radius so the chart stays readable. */
  const ONSITE_NEAR_NM = 8;
  /** Plan seafloor fit (same regional span as On site). */
  const PLAN_FIT_NM = 10;
  const PLAN_NEAR_NM = 8;
  const KELP_QUERY = 'https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds3135_fpu/FeatureServer/0/query';
  const FETCH_MS = 20000;
  const KELP_CACHE_MS = 10 * 60 * 1000;

  /* NCEI elevations (meters). Contour at depth_ft → elev = -ft / 3.28084. */
  const NCEI_ELEV_SAMPLES =
    'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/getSamples';
  const M_PER_FT = 1 / 3.28084;
  const ISOLINE_LEVELS_FT = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 180, 200, 250, 300, 400, 500];
  const ISOLINE_MAJOR_FT = { 30: 1, 60: 1, 100: 1, 150: 1, 200: 1, 300: 1 };
  const ISOLINE_LAYER_NAME = 'Depth isolines (ft)';

  /* NOAA ENC Online — Maritime Chart Service WMS (CORS OK for GH Pages).
   * Layer ids: 10=chart info area, 2=depths/currents, 4=seabed/obstructions, 1=features. */
  const ENC_WMS =
    'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer';
  const ENC_LAYERS = '10,2,4,1';
  const ENC_ATTR =
    'NOAA ENC Online © Office of Coast Survey — not for navigation';

  /* NCEI DEM mosaic ColorHillshade — real elevation/bathymetry relief (not synthesized). */
  const NCEI_DEM_EXPORT =
    'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic_hillshade/ImageServer/exportImage';
  const NCEI_DEM_RENDER = encodeURIComponent(JSON.stringify({ rasterFunction: 'ColorHillshade' }));
  const NCEI_DEM_ATTR =
    'NOAA NCEI DEM ColorHillshade — coastal bathy/topo mosaic; not for navigation';

  /* nowCOAST GeoServer GWC — real BlueTopo hillshade (REST = TileMatrix/TileRow/TileCol).
   * Tiles are 512×512 on a 2^z grid (same indices as Leaflet XYZ). Empty / undelivered = transparent. */
  const BLUETOPO_WMTS =
    'https://nowcoast.noaa.gov/geoserver/gwc/service/wmts/rest/bluetopo:hillshade/nbs_hillshade/EPSG:3857/EPSG:3857:{z}/{y}/{x}?format=image/png8';
  const BLUETOPO_ATTR =
    'NOAA BlueTopo (NBS) © Office of Coast Survey — not for navigation';
  const BLUETOPO_CONFIG_URL = 'bluetopo/config.json';
  const PMTILES_CDN = 'https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js';
  /** Swap tiled DEM for a single screen-matched export at/above this zoom. */
  const DEM_VIEWPORT_MIN_Z = 14;

  const OCEAN_BASE =
    'https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
  const OCEAN_REF =
    'https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}';
  const OCEAN_ATTR =
    'Esri Ocean Base © Esri, Garmin, GEBCO, NOAA NGDC & contributors — not for navigation';
  const OCEAN_REF_ATTR = 'Esri Ocean Reference';
  const SEAMARK_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
  const SEAMARK_ATTR = 'Seamarks © OpenSeaMap contributors';
  const IMAGERY_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const IMAGERY_ATTR =
    'Imagery © Esri — Maxar, Earthstar Geographics & contributors';

  const hosts = new Map();
  const kelpCache = new Map();
  let loadLeafletFn = null;
  let fetchJSON = null;
  let blueTopoConfigP = null;
  let pmtilesLibP = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function f1(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function nmPerDegLon(lat) { return 60 * Math.cos(lat * D2R); }

  function haversineNm(lat1, lon1, lat2, lon2) {
    const p = D2R;
    const a = Math.sin((lat2 - lat1) * p / 2) ** 2 +
      Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
    return (2 * Math.asin(Math.sqrt(a)) * 6371000) / 1852;
  }

  function bboxFromCenter(lat, lon, radiusNm) {
    const dLat = radiusNm / 60;
    const dLon = radiusNm / Math.max(0.2, nmPerDegLon(lat));
    return {
      latMin: lat - dLat,
      latMax: lat + dLat,
      lonMin: lon - dLon,
      lonMax: lon + dLon,
      radiusNm
    };
  }

  function setStatus(host, msg, err) {
    if (!host) return;
    destroyMap(host);
    host.innerHTML = '<div class="seafloor-status' + (err ? ' err' : '') + '">' + esc(msg) + '</div>';
  }

  function destroyMap(host) {
    const st = hosts.get(host);
    if (st?.map) {
      try { if (st.demViewport) st.demViewport.remove(); } catch (e) { /* ignore */ }
      try { if (st.isolineCtrl) st.isolineCtrl.remove(); } catch (e) { /* ignore */ }
      try { st.map.remove(); } catch (e) { /* ignore */ }
      st.map = null;
      st.markers = null;
      st.kelpLayer = null;
      st.layersControl = null;
      st.demViewport = null;
      st.isolineCtrl = null;
    }
  }

  async function fetchJsonSimple(url, timeout) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout || FETCH_MS);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function fetchKelp(lat, lon, radiusM) {
    const key = lat.toFixed(3) + ',' + lon.toFixed(3) + '@' + Math.round(radiusM);
    const hit = kelpCache.get(key);
    if (hit && Date.now() - hit.at < KELP_CACHE_MS) return hit.features;

    const params = new URLSearchParams({
      geometry: lon + ',' + lat,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: String(Math.round(radiusM)),
      units: 'esriSRUnit_Meter',
      outFields: 'KelpBed,Status',
      returnGeometry: 'true',
      f: 'geojson'
    });
    const j = await fetchJsonSimple(KELP_QUERY + '?' + params.toString(), FETCH_MS);
    const features = Array.isArray(j?.features) ? j.features : [];
    kelpCache.set(key, { at: Date.now(), features });
    return features;
  }

  function pinKind(spot) {
    if (spot?.kind) return spot.kind;
    const t = String((spot?.name || '') + ' ' + (spot?.habitat || '')).toLowerCase();
    if (/\bkelp\b/.test(t)) return 'kelp';
    if (/\brock|rubble|jetty|boulder\b/.test(t)) return 'rock';
    if (/\breef|wreck|barge|artificial|module|pipeline\b/.test(t)) return 'reef';
    return 'spot';
  }

  function pinColor(kind, selected) {
    if (selected) return '#ffd966';
    if (kind === 'kelp') return '#3dbf6a';
    if (kind === 'rock') return '#c4a574';
    if (kind === 'reef') return '#e89a4a';
    return '#8ab4c8';
  }

  function pinLabel(kind) {
    if (kind === 'kelp') return 'Kelp';
    if (kind === 'rock') return 'Rock';
    if (kind === 'reef') return 'Reef';
    return 'Spot';
  }

  function markerIcon(kind, selected, shortLabel) {
    const col = pinColor(kind, selected);
    const r = selected ? 11 : 7;
    const ring = selected ? '2.5' : '1.5';
    const label = selected && shortLabel
      ? '<div class="sf-pin-lab" style="color:' + col + '">' + esc(String(shortLabel).slice(0, 18)) + '</div>'
      : '';
    return L.divIcon({
      className: 'sf-pin',
      html: '<div class="sf-pin-wrap">' +
        '<div class="sf-pin-dot" style="width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;background:' + col +
        ';border-width:' + ring + 'px"></div>' + label + '</div>',
      iconSize: [selected ? 120 : 18, selected ? 36 : 18],
      iconAnchor: [selected ? 60 : 9, selected ? 12 : 9]
    });
  }

  function boatIcon() {
    return L.divIcon({
      className: 'sf-boat',
      html: '<div class="sf-boat-mark" title="You">▲</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  function buildLegendHtml(mode) {
    const basemap =
      mode === 'bt' ? '<span><i style="background:#5a8a78"></i>BlueTopo relief</span>' :
      mode === 'dem' ? '<span><i style="background:#1a6b7a"></i>NCEI DEM relief</span>' :
      mode === 'enc' ? '<span><i style="background:#9ec4dc"></i>NOAA ENC soundings</span>' :
      '<span><i style="background:#2a4a62"></i>Esri Ocean Base</span>';
    return '<div class="seafloor-legend">' +
      '<span class="seafloor-legend-title">Chart layers</span>' +
      basemap +
      '<span><i style="background:#ffd966"></i>Selected mark</span>' +
      '<span><i style="background:#3dd6f5"></i>You</span>' +
      '<span><i style="background:#e89a4a"></i>Reef / wreck</span>' +
      '<span><i style="background:#3dbf6a"></i>Kelp</span>' +
      '<span><i style="background:#c4a574"></i>Rock</span>' +
      '<span><i style="background:rgba(35,175,85,.65)"></i>Kelp beds (CDFW)</span>' +
      '</div>';
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-seafloor-src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') resolve();
        else existing.addEventListener('load', () => resolve(), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-seafloor-src', src);
      s.onload = () => { s.setAttribute('data-loaded', '1'); resolve(); };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function loadBlueTopoConfig() {
    if (blueTopoConfigP) return blueTopoConfigP;
    blueTopoConfigP = (async () => {
      const fallback = {
        pmtilesUrl: '',
        wmtsEnabled: true,
        layerLabel: 'BlueTopo relief'
      };
      try {
        const url = (typeof global.BLUETOPO_CONFIG_URL === 'string' && global.BLUETOPO_CONFIG_URL) ||
          BLUETOPO_CONFIG_URL;
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) return fallback;
        const j = await r.json();
        return {
          pmtilesUrl: typeof j.pmtilesUrl === 'string' ? j.pmtilesUrl.trim() : '',
          wmtsEnabled: j.wmtsEnabled !== false,
          layerLabel: typeof j.layerLabel === 'string' && j.layerLabel ? j.layerLabel : 'BlueTopo relief'
        };
      } catch (e) {
        return fallback;
      }
    })();
    return blueTopoConfigP;
  }

  async function ensurePmtilesLib() {
    if (global.pmtiles?.PMTiles && global.pmtiles?.leafletRasterLayer) return global.pmtiles;
    if (!pmtilesLibP) {
      pmtilesLibP = loadScriptOnce(PMTILES_CDN).then(() => {
        if (!global.pmtiles?.PMTiles || !global.pmtiles?.leafletRasterLayer) {
          throw new Error('pmtiles.js loaded without leafletRasterLayer');
        }
        return global.pmtiles;
      });
    }
    return pmtilesLibP;
  }

  /** Shared Leaflet opts: avoid mid-pinch tile storms; prefer sharp settle. */
  const FAST_TILE_OPTS = {
    updateWhenZooming: false,
    updateWhenIdle: true,
    keepBuffer: 2,
    detectRetina: false
  };

  /** DEM fetches during zoom at high z so pinch doesn't stretch a soft overview tile. */
  const DEM_TILE_OPTS = Object.assign({}, FAST_TILE_OPTS, {
    updateWhenZooming: true,
    keepBuffer: 3
  });

  /**
   * NCEI export pixels per 256 CSS tile — supersample harder as you pinch in.
   * Service allows up to 20k; 4096 verified OK. DPR multiplies at z≥15 for retina sharpness.
   */
  function demExportPx(zoom) {
    const z = zoom == null || !isFinite(zoom) ? 12 : +zoom;
    let px = 256;
    if (z >= 20) px = 4096;
    else if (z >= 19) px = 3072;
    else if (z >= 18) px = 2048;
    else if (z >= 17) px = 1536;
    else if (z >= 16) px = 1024;
    else if (z >= 15) px = 768;
    else if (z >= 14) px = 512;
    if (z >= 15) {
      const dpr = (typeof global.devicePixelRatio === 'number' && global.devicePixelRatio > 1)
        ? Math.min(2, global.devicePixelRatio)
        : 1;
      if (dpr > 1.25) px = Math.round(px * dpr);
    }
    return Math.min(4096, px);
  }

  /** Real BlueTopo hillshade: self-hosted PMTiles if configured, else nowCOAST WMTS. */
  async function makeBlueTopoOverlay(cfg) {
    /* Native matrices go through z20; keep maxZoom === maxNativeZoom (no CSS upscale). */
    const common = Object.assign({
      maxZoom: 20,
      maxNativeZoom: 20,
      minZoom: 8,
      opacity: 1,
      pane: 'btOverlay',
      /* 512px server tiles in 256 CSS slots = 2× supersample (retina-native). */
      tileSize: 256,
      detectRetina: false
    }, FAST_TILE_OPTS);
    if (cfg?.pmtilesUrl) {
      try {
        const P = await ensurePmtilesLib();
        const tiles = new P.PMTiles(cfg.pmtilesUrl);
        return P.leafletRasterLayer(tiles, Object.assign({}, common, {
          maxZoom: 17,
          maxNativeZoom: 17,
          attribution: BLUETOPO_ATTR + ' (PMTiles)'
        }));
      } catch (e) {
        console.warn('BlueTopo PMTiles unavailable, trying WMTS', e);
      }
    }
    if (cfg && cfg.wmtsEnabled === false) return null;
    return L.tileLayer(BLUETOPO_WMTS, Object.assign({}, common, {
      attribution: BLUETOPO_ATTR
    }));
  }

  function demViewportUrl(bounds, w, h) {
    const nw = L.CRS.EPSG3857.project(bounds.getNorthWest());
    const se = L.CRS.EPSG3857.project(bounds.getSouthEast());
    const bbox = [nw.x, se.y, se.x, nw.y].join(',');
    return NCEI_DEM_EXPORT +
      '?bbox=' + encodeURIComponent(bbox) +
      '&bboxSR=3857&imageSR=3857&size=' + w + ',' + h +
      '&format=png32&f=image' +
      '&interpolation=RSP_CubicConvolution' +
      '&renderingRule=' + NCEI_DEM_RENDER;
  }

  /**
   * At higher zooms, replace tiled DEM with one export sized to the map viewport.
   * Avoids soft-upscaled overview tiles and samples the mosaic once at screen resolution.
   */
  function attachDemViewport(map, demTileLayers) {
    if (!map.getPane('demViewport')) {
      map.createPane('demViewport');
      /* Above base tiles (200), below BlueTopo overlay pane (360). */
      map.getPane('demViewport').style.zIndex = 350;
    }
    if (!map.getPane('btOverlay')) {
      map.createPane('btOverlay');
      map.getPane('btOverlay').style.zIndex = 360;
      map.getPane('btOverlay').style.pointerEvents = 'none';
    }

    let overlay = null;
    let timer = null;
    let seq = 0;
    const layers = (demTileLayers || []).filter(Boolean);

    function demBaseActive() {
      return layers.some(function (layer) {
        try {
          if (map.hasLayer(layer)) return true;
          /* Layer inside a LayerGroup still has _map set when the group is on the map. */
          return !!(layer._map);
        } catch (e) {
          return false;
        }
      });
    }

    function setTileOpacity(opacity) {
      for (let i = 0; i < layers.length; i++) {
        try { layers[i].setOpacity(opacity); } catch (e) { /* ignore */ }
      }
    }

    function clearOverlay() {
      if (overlay) {
        try { map.removeLayer(overlay); } catch (e) { /* ignore */ }
        overlay = null;
      }
    }

    function refresh() {
      const my = ++seq;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        if (my !== seq) return;
        const z = map.getZoom();
        if (z < DEM_VIEWPORT_MIN_Z || !demBaseActive()) {
          setTileOpacity(1);
          clearOverlay();
          return;
        }
        const size = map.getSize();
        if (!size || size.x < 32 || size.y < 32) return;
        const dpr = (typeof global.devicePixelRatio === 'number' && global.devicePixelRatio > 1)
          ? Math.min(2, global.devicePixelRatio)
          : 1;
        /* Match CSS pixels × DPR, cap for NCEI maxImageWidth and payload size. */
        let w = Math.round(size.x * dpr);
        let h = Math.round(size.y * dpr);
        const maxEdge = 4096;
        if (w > maxEdge || h > maxEdge) {
          const s = maxEdge / Math.max(w, h);
          w = Math.max(64, Math.round(w * s));
          h = Math.max(64, Math.round(h * s));
        }
        const bounds = map.getBounds().pad(0.02);
        const url = demViewportUrl(bounds, w, h);
        const next = L.imageOverlay(url, bounds, {
          pane: 'demViewport',
          opacity: 1,
          interactive: false,
          className: 'seafloor-dem-viewport'
        });
        next.on('load', function () {
          if (my !== seq) {
            try { map.removeLayer(next); } catch (e) { /* ignore */ }
            return;
          }
          setTileOpacity(0);
          clearOverlay();
          overlay = next;
        });
        next.on('error', function () {
          if (my !== seq) return;
          setTileOpacity(1);
        });
        next.addTo(map);
      }, 120);
    }

    map.on('moveend zoomend resize', refresh);
    map.on('baselayerchange', refresh);
    setTimeout(refresh, 80);
    return {
      refresh: refresh,
      remove: function () {
        seq++;
        if (timer) clearTimeout(timer);
        map.off('moveend zoomend resize', refresh);
        map.off('baselayerchange', refresh);
        clearOverlay();
        setTileOpacity(1);
      }
    };
  }

  /* --- Fishing-style depth isolines (NCEI getSamples + marching squares) --- */
  function isolineLerp(a, b, t) { return a + (b - a) * t; }
  function isolineEdgePoint(x0, y0, x1, y1, v0, v1, level) {
    const t = (Math.abs(v1 - v0) < 1e-9) ? 0.5 : (level - v0) / (v1 - v0);
    return [isolineLerp(x0, x1, t), isolineLerp(y0, y1, t)];
  }

  function isolineStitch(segs) {
    if (!segs.length) return [];
    const key = (p) => p[0].toFixed(5) + ',' + p[1].toFixed(5);
    const used = new Array(segs.length).fill(false);
    const lines = [];
    for (let s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      used[s] = true;
      let line = [segs[s][0], segs[s][1]];
      let grew = true;
      while (grew) {
        grew = false;
        const head = key(line[0]);
        const tail = key(line[line.length - 1]);
        for (let i = 0; i < segs.length; i++) {
          if (used[i]) continue;
          const a = key(segs[i][0]), b = key(segs[i][1]);
          if (a === tail) { line.push(segs[i][1]); used[i] = true; grew = true; break; }
          if (b === tail) { line.push(segs[i][0]); used[i] = true; grew = true; break; }
          if (a === head) { line.unshift(segs[i][1]); used[i] = true; grew = true; break; }
          if (b === head) { line.unshift(segs[i][0]); used[i] = true; grew = true; break; }
        }
      }
      if (line.length >= 2) lines.push(line);
    }
    return lines;
  }

  function isolineMarch(grid, xs, ys, level) {
    const rows = grid.length;
    const cols = grid[0].length;
    const segs = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const v00 = grid[j][i], v10 = grid[j][i + 1];
        const v01 = grid[j + 1][i], v11 = grid[j + 1][i + 1];
        if ([v00, v10, v01, v11].some(v => v == null || !isFinite(v))) continue;
        const b0 = v00 >= level ? 1 : 0;
        const b1 = v10 >= level ? 2 : 0;
        const b2 = v11 >= level ? 4 : 0;
        const b3 = v01 >= level ? 8 : 0;
        const idx = b0 | b1 | b2 | b3;
        if (idx === 0 || idx === 15) continue;
        const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
        const top = () => isolineEdgePoint(x0, y0, x1, y0, v00, v10, level);
        const right = () => isolineEdgePoint(x1, y0, x1, y1, v10, v11, level);
        const bottom = () => isolineEdgePoint(x0, y1, x1, y1, v01, v11, level);
        const left = () => isolineEdgePoint(x0, y0, x0, y1, v00, v01, level);
        const cases = {
          1: [left, top], 2: [top, right], 3: [left, right], 4: [right, bottom],
          5: [left, top, right, bottom], 6: [top, bottom], 7: [left, bottom],
          8: [bottom, left], 9: [top, bottom], 10: [top, right, bottom, left],
          11: [right, bottom], 12: [right, left], 13: [top, right], 14: [top, left]
        };
        const fns = cases[idx];
        if (!fns) continue;
        for (let k = 0; k < fns.length; k += 2) {
          segs.push([fns[k](), fns[k + 1]()]);
        }
      }
    }
    return isolineStitch(segs);
  }

  function isolineGridFromSamples(samples, west, east, south, north, nCol, nRow) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < nCol; i++) xs.push(west + (east - west) * (i / (nCol - 1)));
    for (let j = 0; j < nRow; j++) ys.push(north - (north - south) * (j / (nRow - 1)));
    const grid = Array.from({ length: nRow }, () => Array(nCol).fill(null));
    const bin = Array.from({ length: nRow }, () => Array.from({ length: nCol }, () => []));
    for (let s = 0; s < samples.length; s++) {
      const sample = samples[s];
      const v = typeof sample.value === 'number' ? sample.value : parseFloat(sample.value);
      if (!isFinite(v) || !sample.location) continue;
      const x = sample.location.x, y = sample.location.y;
      const i = Math.round((x - west) / (east - west) * (nCol - 1));
      const j = Math.round((north - y) / (north - south) * (nRow - 1));
      if (i < 0 || j < 0 || i >= nCol || j >= nRow) continue;
      bin[j][i].push(v);
    }
    for (let j = 0; j < nRow; j++) {
      for (let i = 0; i < nCol; i++) {
        const arr = bin[j][i];
        if (!arr.length) continue;
        let sum = 0;
        for (let k = 0; k < arr.length; k++) sum += arr[k];
        grid[j][i] = sum / arr.length;
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nRow; j++) {
        for (let i = 0; i < nCol; i++) {
          if (grid[j][i] != null) continue;
          let sum = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const jj = j + dj, ii = i + di;
              if (jj < 0 || ii < 0 || jj >= nRow || ii >= nCol) continue;
              if (grid[jj][ii] == null) continue;
              sum += grid[jj][ii]; n++;
            }
          }
          if (n >= 3) grid[j][i] = sum / n;
        }
      }
    }
    return { grid, xs, ys };
  }

  async function isolineFetchEnvelope(w, s, e, n, nn) {
    const span = Math.max(e - w, n - s);
    const dist = span / (nn * 1.02);
    const geom = JSON.stringify({
      xmin: w, ymin: s, xmax: e, ymax: n,
      spatialReference: { wkid: 4326 }
    });
    const url = NCEI_ELEV_SAMPLES +
      '?geometry=' + encodeURIComponent(geom) +
      '&geometryType=esriGeometryEnvelope' +
      '&sampleDistance=' + dist +
      '&sampleCount=' + (nn * nn) +
      '&f=pjson';
    return fetchJsonSimple(url, FETCH_MS);
  }

  /**
   * Toggleable fishing-style depth isolines (feet). Live-reloads on pan/zoom when on.
   * Off by default — add via layers control.
   */
  function attachDepthIsolines(map) {
    const contourGroup = L.layerGroup();
    let timer = null;
    let seq = 0;
    let active = false;

    async function refresh() {
      if (!active || !map) return;
      const my = ++seq;
      const b = map.getBounds().pad(0.04);
      const z = map.getZoom();
      const west = b.getWest(), east = b.getEast(), south = b.getSouth(), north = b.getNorth();
      /* Sample density by zoom. NCEI getSamples soft-caps ~1000 pts/request, so
         mid/high zoom uses 2x2 batched envelopes (4 parallel). Prior densify:
         nTarget 36/46/60/72/84, nQuad 38/42/46/50, batch z>=13. Now tighter at
         every band + batch from z>=11 so overview/Plan also clear the soft cap. */
      let nTarget = z >= 17 ? 100 : (z >= 16 ? 88 : (z >= 14 ? 72 : (z >= 12 ? 58 : 48)));
      const useBatch = z >= 11;
      let samples = [];
      try {
        if (useBatch) {
          const nQuad = z >= 17 ? 56 : (z >= 16 ? 52 : (z >= 14 ? 48 : 44));
          const mx = (west + east) / 2, myLat = (south + north) / 2;
          const quads = [
            [west, south, mx, myLat], [mx, south, east, myLat],
            [west, myLat, mx, north], [mx, myLat, east, north]
          ];
          let parts = await Promise.all(quads.map(q => isolineFetchEnvelope(q[0], q[1], q[2], q[3], nQuad)));
          if (parts.some(p => p.error || !(p.samples && p.samples.length))) {
            const one = await isolineFetchEnvelope(west, south, east, north, nTarget);
            parts = [one];
          }
          for (let i = 0; i < parts.length; i++) {
            if (parts[i].error) throw new Error(parts[i].error.message || 'sample error');
            samples = samples.concat(parts[i].samples || []);
          }
          nTarget = Math.max(nTarget, nQuad * 2);
        } else {
          let data = await isolineFetchEnvelope(west, south, east, north, nTarget);
          if (data.error ||
              ((data.samples || []).length < Math.min(48, nTarget * nTarget * 0.35) && nTarget > 32)) {
            nTarget = Math.max(28, Math.round(nTarget * 0.7));
            data = await isolineFetchEnvelope(west, south, east, north, nTarget);
          }
          if (data.error) throw new Error(data.error.message || 'sample error');
          samples = data.samples || [];
        }
      } catch (e) {
        console.warn('depth isolines', e);
        return;
      }
      if (my !== seq || !active) return;
      if (samples.length < 16) {
        contourGroup.clearLayers();
        return;
      }

      const nEff = Math.min(nTarget, Math.max(16, Math.round(Math.sqrt(samples.length * 1.05))));
      const packed = isolineGridFromSamples(samples, west, east, south, north, nEff, nEff);
      const grid = packed.grid, xs = packed.xs, ys = packed.ys;
      contourGroup.clearLayers();

      for (let li = 0; li < ISOLINE_LEVELS_FT.length; li++) {
        const ft = ISOLINE_LEVELS_FT[li];
        const level = -ft * M_PER_FT;
        const paths = isolineMarch(grid, xs, ys, level);
        const major = !!ISOLINE_MAJOR_FT[ft];
        for (let pi = 0; pi < paths.length; pi++) {
          const path = paths[pi];
          if (path.length < 2) continue;
          const latlngs = path.map(p => [p[1], p[0]]);
          L.polyline(latlngs, {
            color: major ? '#ffe566' : '#5dffd0',
            weight: major ? 2.25 : 1.15,
            opacity: major ? 0.95 : 0.75,
            lineJoin: 'round',
            interactive: false,
            className: 'fish-isoline'
          }).addTo(contourGroup);
          if (major && path.length > 6) {
            const mid = path[Math.floor(path.length / 2)];
            L.marker([mid[1], mid[0]], {
              interactive: false,
              icon: L.divIcon({
                className: 'contour-label',
                html: ft + ' ft',
                iconSize: [56, 14],
                iconAnchor: [28, 7]
              })
            }).addTo(contourGroup);
          }
        }
      }
    }

    function schedule() {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 180);
    }

    function onOverlayAdd(e) {
      if (e.layer !== contourGroup) return;
      active = true;
      schedule();
    }
    function onOverlayRemove(e) {
      if (e.layer !== contourGroup) return;
      active = false;
      seq++;
      if (timer) clearTimeout(timer);
      contourGroup.clearLayers();
    }

    map.on('overlayadd', onOverlayAdd);
    map.on('overlayremove', onOverlayRemove);
    map.on('moveend zoomend', schedule);

    return {
      layer: contourGroup,
      name: ISOLINE_LAYER_NAME,
      remove: function () {
        active = false;
        seq++;
        if (timer) clearTimeout(timer);
        map.off('overlayadd', onOverlayAdd);
        map.off('overlayremove', onOverlayRemove);
        map.off('moveend zoomend', schedule);
        try { map.removeLayer(contourGroup); } catch (e) { /* ignore */ }
        contourGroup.clearLayers();
      }
    };
  }

  function ensureShell(host, mode) {
    let mapEl = host.querySelector('.seafloor-map');
    let legendEl = host.querySelector('.seafloor-legend');
    if (!mapEl) {
      host.innerHTML = '';
      mapEl = document.createElement('div');
      mapEl.className = 'seafloor-map';
      mapEl.setAttribute('role', 'application');
      mapEl.setAttribute('aria-label', 'Bathymetry chart — pinch to zoom');
      host.appendChild(mapEl);
      host.insertAdjacentHTML('beforeend', buildLegendHtml(mode || 'ocean'));
      legendEl = host.querySelector('.seafloor-legend');
    }
    return { mapEl, legendEl };
  }

  /** Leaflet tiles from NCEI ImageServer exportImage (real DEM hillshade). */
  function makeNceiDemLayer() {
    const NceiDem = L.TileLayer.extend({
      getTileUrl: function (coords) {
        const bounds = this._tileCoordsToBounds(coords);
        const nw = L.CRS.EPSG3857.project(bounds.getNorthWest());
        const se = L.CRS.EPSG3857.project(bounds.getSouthEast());
        const bbox = [nw.x, se.y, se.x, nw.y].join(',');
        const z = coords.z + (this.options.zoomOffset || 0);
        const px = demExportPx(z);
        const fmt = z >= 15 ? 'png32' : 'png8';
        /* Cubic only when supersampling hard — keeps overview fetches snappy. */
        const interp = z >= 16 ? 'RSP_CubicConvolution' : 'RSP_BilinearInterpolation';
        return NCEI_DEM_EXPORT +
          '?bbox=' + bbox +
          '&bboxSR=3857&imageSR=3857&size=' + px + ',' + px +
          '&format=' + fmt + '&f=image' +
          '&interpolation=' + interp +
          '&renderingRule=' + NCEI_DEM_RENDER;
      }
    });
    return new NceiDem('', Object.assign({
      /* Always request this zoom’s tiles — no soft upscale past maxNativeZoom. */
      maxZoom: 21,
      maxNativeZoom: 21,
      minZoom: 8,
      attribution: NCEI_DEM_ATTR,
      opacity: 1
    }, DEM_TILE_OPTS));
  }

  async function addBaseLayers(map, opts) {
    const preferDem = !!opts.preferDem;
    const preferEnc = !preferDem && !!opts.preferEnc;
    const preferBlueTopo = preferDem && !!opts.blueTopoLayer;

    if (!map.getPane('demViewport')) {
      map.createPane('demViewport');
      map.getPane('demViewport').style.zIndex = 350;
    }
    if (!map.getPane('btOverlay')) {
      map.createPane('btOverlay');
      map.getPane('btOverlay').style.zIndex = 360;
      map.getPane('btOverlay').style.pointerEvents = 'none';
    }

    /* Ocean Base native tiles stop at z16; allow upscale so pinch-in stays useful locally. */
    const ocean = L.tileLayer(OCEAN_BASE, {
      maxNativeZoom: 16,
      maxZoom: 19,
      minZoom: 3,
      attribution: OCEAN_ATTR
    });
    const oceanRef = L.tileLayer(OCEAN_REF, {
      maxNativeZoom: 16,
      maxZoom: 19,
      minZoom: 3,
      attribution: OCEAN_REF_ATTR,
      opacity: 0.95
    });
    const oceanGroup = L.layerGroup([ocean, oceanRef]);
    const imagery = L.tileLayer(IMAGERY_URL, {
      maxZoom: 19,
      minZoom: 3,
      attribution: IMAGERY_ATTR
    });
    const seamarks = L.tileLayer(SEAMARK_URL, Object.assign({
      maxZoom: 18,
      minZoom: 9,
      attribution: SEAMARK_ATTR,
      opacity: 0.9
    }, FAST_TILE_OPTS));
    /* Separate DEM instances — Leaflet cannot share one layer across two base entries. */
    const demSolo = makeNceiDemLayer();
    const demUnderBt = makeNceiDemLayer();
    const enc = L.tileLayer.wms(ENC_WMS, Object.assign({
      layers: ENC_LAYERS,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      attribution: ENC_ATTR,
      maxZoom: 21,
      minZoom: 11,
      opacity: 1,
      uppercase: true
    }, FAST_TILE_OPTS));

    let blueTopoGroup = null;
    const btLabel = opts.blueTopoLabel || 'BlueTopo relief';
    const blueTopoLayer = opts.blueTopoLayer || null;
    if (blueTopoLayer) {
      blueTopoGroup = L.layerGroup([demUnderBt, blueTopoLayer]);
    }

    function anyDetailBase() {
      return (blueTopoGroup && map.hasLayer(blueTopoGroup)) ||
        map.hasLayer(demSolo) || map.hasLayer(enc) ||
        map.hasLayer(oceanGroup) || map.hasLayer(imagery);
    }

    function ensureFallback(removeLayer) {
      if (map.hasLayer(removeLayer)) map.removeLayer(removeLayer);
      if (!anyDetailBase()) {
        if (blueTopoGroup) blueTopoGroup.addTo(map);
        else demSolo.addTo(map);
      }
    }

    let demErr = 0; let demFb = false;
    demSolo.on('tileerror', () => {
      demErr++;
      if (demFb || demErr < 6) return;
      demFb = true;
      ensureFallback(demSolo);
    });
    let encErr = 0; let encFb = false;
    enc.on('tileerror', () => {
      encErr++;
      if (encFb || encErr < 6) return;
      encFb = true;
      ensureFallback(enc);
    });
    let oceanErr = 0; let oceanFb = false;
    ocean.on('tileerror', () => {
      oceanErr++;
      if (oceanFb || oceanErr < 5) return;
      oceanFb = true;
      if (map.hasLayer(oceanGroup)) map.removeLayer(oceanGroup);
      if (!anyDetailBase()) imagery.addTo(map);
    });

    const bases = {};
    if (blueTopoGroup) bases[btLabel] = blueTopoGroup;
    bases['NCEI DEM relief'] = demSolo;
    bases['NOAA ENC detail'] = enc;
    bases['Ocean chart'] = oceanGroup;
    bases['Satellite'] = imagery;

    /* Prefer BlueTopo stack (DEM underlay + BT). Tile URL sizing stays zoom-adaptive for speed. */
    if (preferBlueTopo && blueTopoGroup) blueTopoGroup.addTo(map);
    else if (preferDem) demSolo.addTo(map);
    else if (preferEnc) enc.addTo(map);
    else oceanGroup.addTo(map);

    const demViewport = (preferDem || preferBlueTopo)
      ? attachDemViewport(map, [demSolo, demUnderBt])
      : null;

    /* Seamarks are secondary — defer so DEM/BlueTopo win the first network slots. */
    setTimeout(() => {
      try { if (!map.hasLayer(seamarks)) seamarks.addTo(map); } catch (e) { /* ignore */ }
    }, 400);

    const isolineCtrl = attachDepthIsolines(map);
    const overlays = {
      'Seamarks': seamarks
    };
    overlays[isolineCtrl.name] = isolineCtrl.layer;
    const layersControl = L.control.layers(bases, overlays, {
      position: opts.layersPosition || 'topright',
      collapsed: true
    }).addTo(map);

    return {
      oceanGroup, imagery, seamarks, enc, dem: demSolo,
      blueTopoGroup, layersControl, demViewport, isolineCtrl,
      usingBlueTopo: !!(preferBlueTopo && blueTopoGroup),
      mode: preferBlueTopo && blueTopoGroup ? 'bt' : (preferDem ? 'dem' : (preferEnc ? 'enc' : 'ocean'))
    };
  }

  /**
   * Attach the shared On site basemap stack to an existing Leaflet map
   * (BlueTopo relief default over NCEI DEM, plus ENC / Ocean / Satellite toggles).
   * Used by Fish/Dive On site and pin-trust-review — do not duplicate tile URLs elsewhere.
   */
  async function attachBasemap(map, opts) {
    opts = opts || {};
    const preferDem = opts.preferDem !== false;
    const preferEnc = !preferDem && !!opts.preferEnc;
    const btCfg = preferDem ? await loadBlueTopoConfig() : null;
    let blueTopoLayer = null;
    if (preferDem && btCfg) {
      try {
        blueTopoLayer = await makeBlueTopoOverlay(btCfg);
      } catch (e) {
        console.warn('BlueTopo layer', e);
      }
    }
    const added = await addBaseLayers(map, {
      preferDem,
      preferEnc,
      blueTopoLayer,
      blueTopoLabel: (btCfg && btCfg.layerLabel) || 'BlueTopo relief',
      layersPosition: opts.layersPosition || 'topright'
    });
    if (opts.includeSeamarks === false && added.seamarks && map.hasLayer(added.seamarks)) {
      map.removeLayer(added.seamarks);
    }
    const mapEl = map.getContainer && map.getContainer();
    if (mapEl) {
      mapEl.classList.add('seafloor-leaflet');
      mapEl.classList.toggle('seafloor-dem', added.mode === 'bt' || added.mode === 'dem');
      mapEl.classList.toggle('seafloor-bt', added.mode === 'bt');
      mapEl.classList.toggle('seafloor-enc', added.mode === 'enc');
    }
    return added;
  }

  /** Fit a local structure-scale box around lat/lon (On site / review). */
  function fitLocalView(map, lat, lon, radiusNm, fitMaxZoom) {
    fitView(map, {
      centerLat: lat,
      centerLon: lon,
      markLat: lat,
      markLon: lon,
      radiusNm: radiusNm != null ? radiusNm : ONSITE_FIT_NM,
      fitMaxZoom: fitMaxZoom != null ? fitMaxZoom : undefined
    });
  }

  function paintMarkers(st, opts) {
    const Lref = global.L;
    if (!st.map || !Lref) return;
    if (st.markers) st.markers.clearLayers();
    else st.markers = Lref.layerGroup().addTo(st.map);

    const centerLat = opts.centerLat;
    const centerLon = opts.centerLon;
    const markLat = opts.markLat;
    const markLon = opts.markLon;
    const markKey = markLat != null && markLon != null
      ? markLat.toFixed(5) + ',' + markLon.toFixed(5)
      : '';

    st.markers.addLayer(Lref.marker([centerLat, centerLon], {
      icon: boatIcon(),
      zIndexOffset: 1200,
      interactive: false
    }));

    const nearby = Array.isArray(opts.nearby) ? opts.nearby : [];
    let nearCount = 0;
    for (const spot of nearby) {
      if (spot?.lat == null || spot?.lon == null) continue;
      const key = spot.lat.toFixed(5) + ',' + spot.lon.toFixed(5);
      const selected = markKey && key === markKey;
      if (selected) continue;
      const kind = pinKind(spot);
      const distBoat = haversineNm(centerLat, centerLon, spot.lat, spot.lon);
      const distMark = markLat != null
        ? haversineNm(markLat, markLon, spot.lat, spot.lon)
        : distBoat;
      const depthBit = spot.depth != null ? ' · ' + spot.depth + (typeof spot.depth === 'number' ? ' ft' : '') : '';
      const tip = (spot.name || pinLabel(kind)) + depthBit + ' · ' + f1(distMark) + ' nm';
      st.markers.addLayer(Lref.marker([spot.lat, spot.lon], {
        icon: markerIcon(kind, false),
        zIndexOffset: 200,
        title: tip
      }).bindPopup('<strong>' + esc(spot.name || pinLabel(kind)) + '</strong><br>' +
        esc(pinLabel(kind)) + (depthBit ? esc(depthBit) : '') + '<br>' + f1(distMark) + ' nm from mark · ' +
        f1(distBoat) + ' nm from you'));
      nearCount++;
    }

    if (markLat != null && markLon != null) {
      const dist = haversineNm(centerLat, centerLon, markLat, markLon);
      const kind = pinKind({ name: opts.markLabel, habitat: opts.habitat, kind: opts.markKind });
      const lab = opts.markLabel ? String(opts.markLabel) : 'MARK';
      st.markers.addLayer(Lref.marker([markLat, markLon], {
        icon: markerIcon(kind, true, lab),
        zIndexOffset: 900,
        title: lab
      }).bindPopup('<strong>' + esc(lab) + '</strong><br>' +
        (opts.habitat ? esc(opts.habitat) + '<br>' : '') +
        f1(dist) + ' nm from you'));
    }

    return nearCount;
  }

  function paintKelp(st, features) {
    const Lref = global.L;
    if (!st.map || !Lref) return 0;
    if (st.kelpLayer) {
      st.map.removeLayer(st.kelpLayer);
      st.kelpLayer = null;
    }
    if (!features?.length) return 0;
    st.kelpLayer = Lref.geoJSON({ type: 'FeatureCollection', features }, {
      style: {
        color: 'rgba(120,255,150,.75)',
        weight: 1.2,
        fillColor: '#23af55',
        fillOpacity: 0.35,
        interactive: true
      },
      onEachFeature: (feat, layer) => {
        const name = feat?.properties?.KelpBed || feat?.properties?.Status || 'Kelp bed';
        layer.bindPopup(esc(String(name)));
      }
    }).addTo(st.map);
    return features.length;
  }

  function fitView(map, opts) {
    const radiusNm = opts.radiusNm != null ? opts.radiusNm : ONSITE_FIT_NM;
    /* Fit around the mark (structure), not boat+mark — boat at the slip would yank zoom to multi-NM. */
    const focusLat = opts.markLat != null ? opts.markLat : opts.centerLat;
    const focusLon = opts.markLon != null ? opts.markLon : opts.centerLon;
    const bb = bboxFromCenter(focusLat, focusLon, radiusNm);
    const bounds = L.latLngBounds(
      [bb.latMin, bb.lonMin],
      [bb.latMax, bb.lonMax]
    );
    if (opts.centerLat != null && opts.centerLon != null &&
        (opts.markLat == null || haversineNm(focusLat, focusLon, opts.centerLat, opts.centerLon) <= radiusNm * 1.2)) {
      bounds.extend([opts.centerLat, opts.centerLon]);
    }
    const fitMax = opts.fitMaxZoom != null ? opts.fitMaxZoom : (radiusNm <= 0.5 ? 19 : (radiusNm <= 3 ? 16 : 14));
    map.fitBounds(bounds.pad(0.06), { maxZoom: fitMax, animate: false });
  }

  async function ensureLeaflet() {
    if (global.L) return global.L;
    if (loadLeafletFn) {
      await loadLeafletFn();
      if (global.L) return global.L;
    }
    throw new Error('Leaflet failed to load');
  }

  async function loadAndRender(hostId, opts) {
    const host = typeof hostId === 'string' ? document.getElementById(hostId) : hostId;
    if (!host) return;
    const metaEl = opts.metaEl ? document.getElementById(opts.metaEl) : null;
    const reqId = (hosts.get(host)?.reqId || 0) + 1;
    const prev = hosts.get(host) || {};
    hosts.set(host, { ...prev, reqId, opts });

    if (!opts || opts.centerLat == null || opts.centerLon == null) {
      setStatus(host, 'No position for chart.', true);
      return;
    }

    try {
      const existing = hosts.get(host);
      if (!existing?.map) setStatus(host, 'Loading chart…');
      await ensureLeaflet();
      if (hosts.get(host)?.reqId !== reqId) return;

      /* Prefer DEM/BlueTopo for On site & Plan spans; ENC only when explicitly requested. */
      const preferDem = opts.preferEnc === true
        ? !!opts.preferDem
        : (opts.preferDem !== false);
      const preferEnc = !preferDem && (opts.preferEnc === true);

      const btCfg = preferDem ? await loadBlueTopoConfig() : null;
      if (hosts.get(host)?.reqId !== reqId) return;
      let blueTopoLayer = null;
      if (preferDem && btCfg) {
        try {
          blueTopoLayer = await makeBlueTopoOverlay(btCfg);
        } catch (e) {
          console.warn('BlueTopo layer', e);
        }
      }
      if (hosts.get(host)?.reqId !== reqId) return;

      const usingBt = !!(preferDem && blueTopoLayer);
      const mode = usingBt ? 'bt' : (preferDem ? 'dem' : (preferEnc ? 'enc' : 'ocean'));
      const { mapEl } = ensureShell(host, mode);
      let st = hosts.get(host) || { reqId, opts };
      st.reqId = reqId;
      st.opts = opts;

      if (!st.map) {
        st.map = L.map(mapEl, {
          zoomControl: true,
          attributionControl: false,
          minZoom: 8,
          maxZoom: 19,
          zoomSnap: 1,
          /* Instant zoom — no CSS-stretch of old tiles between levels (main “blurry” feel). */
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          scrollWheelZoom: true,
          tapTolerance: 18
        });
        L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(st.map);
        if (usingBt || preferDem) {
          mapEl.classList.add('seafloor-leaflet', 'seafloor-dem');
          if (usingBt) mapEl.classList.add('seafloor-bt');
        } else if (preferEnc) {
          mapEl.classList.add('seafloor-leaflet', 'seafloor-enc');
        } else {
          mapEl.classList.add('ocean-map-dark', 'seafloor-leaflet');
        }
        const added = await addBaseLayers(st.map, {
          preferDem,
          preferEnc,
          blueTopoLayer,
          blueTopoLabel: btCfg?.layerLabel || 'BlueTopo relief'
        });
        st.usingBlueTopo = added.usingBlueTopo;
        st.demViewport = added.demViewport;
        st.isolineCtrl = added.isolineCtrl;
        st.markers = L.layerGroup().addTo(st.map);
      }

      hosts.set(host, st);

      const radiusNm = opts.radiusNm != null ? opts.radiusNm : ONSITE_FIT_NM;
      const kelpLat = opts.markLat != null ? opts.markLat : opts.centerLat;
      const kelpLon = opts.markLon != null ? opts.markLon : opts.centerLon;
      const kelpP = fetchKelp(kelpLat, kelpLon, Math.max(radiusNm, ONSITE_NEAR_NM) * 1852 * 1.05).catch(e => {
        console.warn('kelp fetch', e);
        return [];
      });

      const nearCount = paintMarkers(st, opts);
      fitView(st.map, opts);
      setTimeout(() => { try { st.map.invalidateSize(true); } catch (e) { /* ignore */ } }, 60);
      setTimeout(() => { try { st.map.invalidateSize(true); } catch (e) { /* ignore */ } }, 280);

      const kelp = await kelpP;
      if (hosts.get(host)?.reqId !== reqId) return;
      const kelpCount = paintKelp(st, kelp);

      const radiusFt = Math.round(radiusNm * FT_PER_NM);
      const spanLbl = radiusNm <= 0.5
        ? '~' + radiusFt + ' ft (' + f1(radiusNm) + ' nm)'
        : '~' + f1(radiusNm) + ' nm';
      const chartLbl = st.usingBlueTopo
        ? 'BlueTopo relief + NCEI DEM + OpenSeaMap'
        : (preferDem ? 'NCEI DEM relief + OpenSeaMap'
          : (preferEnc ? 'NOAA ENC detail + OpenSeaMap' : 'Esri Ocean Base + OpenSeaMap'));
      const baseMeta =
        chartLbl + ' · pinch-zoom · ' +
        nearCount + ' nearby pin' + (nearCount === 1 ? '' : 's') +
        ' · ' + kelpCount + ' kelp bed' + (kelpCount === 1 ? '' : 's') +
        ' · ' + spanLbl +
        (opts.habitat ? ' · <span class="seafloor-habitat">' + esc(opts.habitat) + '</span>' : '') +
        ' · <span class="seafloor-note">Relief uses ~3&nbsp;m public DEM where BlueTopo is undelivered — extreme pinch softens source cells. Not for navigation.</span>';
      if (metaEl) metaEl.innerHTML = baseMeta;
    } catch (e) {
      console.error('seafloor chart', e);
      if (hosts.get(host)?.reqId !== reqId) return;
      setStatus(host, 'Could not load chart: ' + (e.message || e), true);
      if (metaEl) metaEl.innerHTML = '';
    }
  }

  function init(deps) {
    fetchJSON = deps?.fetchJSON || fetchJSON;
    loadLeafletFn = deps?.loadLeaflet || loadLeafletFn || global.loadLeaflet || null;
  }

  function update(hostId, opts) {
    if (!fetchJSON && global.fetchJSON) fetchJSON = global.fetchJSON;
    if (!loadLeafletFn && global.loadLeaflet) loadLeafletFn = global.loadLeaflet;
    loadAndRender(hostId, opts || {});
  }

  function refreshVisible() {
    for (const [host, st] of hosts) {
      if (host.isConnected && st.opts) loadAndRender(host, st.opts);
    }
  }

  global.SeafloorRender = {
    init,
    update,
    refreshVisible,
    attachBasemap,
    fitLocalView,
    FT_PER_NM,
    ONSITE_FIT_FT,
    ONSITE_FIT_NM,
    ONSITE_NEAR_NM,
    PLAN_FIT_NM,
    PLAN_NEAR_NM
  };
})(window);
