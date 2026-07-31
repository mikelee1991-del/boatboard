'use strict';
/* Seafloor bathymetry + kelp/reef render — Open Waters tiles + CDFW kelp beds (ERDDAP fallback) */

(function (global) {
  const D2R = Math.PI / 180;
  const M2FT = 3.28084;
  const ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap';
  const DEPTH_DS = 'erdSrtm30plusSeafloorGradient';
  const DEPTH_FB = 'erdEtopoSeafloorGradient';
  const TILE_BASE = 'https://tiles.openwaters.io/seascape';
  const TILE_SOURCE = 'Open Waters Seascape (NOAA CUDEM / BlueTopo mosaic, ~3–10 m)';
  const KELP_QUERY = 'https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds3135_fpu/FeatureServer/0/query';
  const CACHE_MS = 8 * 60 * 1000;
  const FETCH_MS = 55000;
  const TILE_GRID = 52;
  const SVG_SIZE = 520;

  const DEPTH_FT = [0, 10, 20, 40, 60, 100, 150, 250];
  const DEPTH_COL = ['#3d5a72', '#334e64', '#294256', '#1f3648', '#182a38', '#121e2a', '#0c141c', '#060a10'];
  const CONTOUR_FT = [10, 20, 40, 60, 100];
  const CONTOUR_LABEL_FT = new Set([20, 40, 100]);

  const hosts = new Map();
  const cache = new Map();
  const tileCache = new Map();
  let fetchJSON = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function f1(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function f0(v) { return v == null || !isFinite(v) ? '—' : String(Math.round(v)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function to360(lon) { return lon < 0 ? lon + 360 : lon; }
  function from360(lon) { return lon > 180 ? lon - 360 : lon; }

  function cacheKey(lat, lon, radiusNm) {
    return lat.toFixed(3) + ',' + lon.toFixed(3) + '@' + radiusNm;
  }

  function nmPerDegLon(lat) { return 60 * Math.cos(lat * D2R); }

  function bboxFromCenter(lat, lon, radiusNm) {
    const dLat = radiusNm / 60;
    const dLon = radiusNm / nmPerDegLon(lat);
    return {
      latMin: lat - dLat,
      latMax: lat + dLat,
      lonMin: lon - dLon,
      lonMax: lon + dLon,
      radiusNm
    };
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

  async function requestJSON(url, timeout) {
    if (fetchJSON) return fetchJSON(url, timeout);
    return fetchJsonSimple(url, timeout);
  }

  function terrariumElev(r, g, b) {
    return (r * 256 + g + b / 256) - 32768;
  }

  function latToTileY(lat, z) {
    const latRad = lat * D2R;
    return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
  }

  function lonToTileX(lon, z) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, z));
  }

  function pickTileZoom(radiusNm) {
    if (radiusNm <= 1.5) return 14;
    if (radiusNm <= 2.5) return 13;
    if (radiusNm <= 3.5) return 12;
    return 11;
  }

  async function loadTileImage(z, x, y) {
    const key = z + '/' + x + '/' + y;
    if (tileCache.has(key)) return tileCache.get(key);
    const url = TILE_BASE + '/' + z + '/' + x + '/' + y + '.webp';
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, 256, 256));
      };
      img.onerror = () => reject(new Error('tile load failed'));
      img.src = url;
    });
    tileCache.set(key, p);
    return p;
  }

  function sampleTerrarium(imageData, lat, lon, z, tx, ty) {
    const n = Math.pow(2, z);
    const fx = (lon + 180) / 360 * n - tx;
    const latRad = lat * D2R;
    const fy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - ty;
    const px = clamp(Math.floor(fx * 256), 0, 255);
    const py = clamp(Math.floor(fy * 256), 0, 255);
    const i = (py * 256 + px) * 4;
    const d = imageData.data;
    return terrariumElev(d[i], d[i + 1], d[i + 2]);
  }

  function computeGradGrid(depthGrid) {
    const { lats, lons, grid } = depthGrid;
    const gGrid = Array.from({ length: lats.length }, () => Array(lons.length).fill(null));
    for (let i = 1; i < lats.length - 1; i++) {
      for (let j = 1; j < lons.length - 1; j++) {
        const d = depthMeters(grid[i][j]);
        if (d == null) continue;
        const dLat = depthMeters(grid[i + 1][j]);
        const dLon = depthMeters(grid[i][j + 1]);
        if (dLat == null && dLon == null) continue;
        const mPerLat = 111320;
        const mPerLon = 111320 * Math.cos(lats[i] * D2R);
        const dLatM = dLat != null ? Math.abs(dLat - d) / Math.max(1e-6, mPerLat * Math.abs(lats[i + 1] - lats[i])) : 0;
        const dLonM = dLon != null ? Math.abs(dLon - d) / Math.max(1e-6, mPerLon * Math.abs(lons[j + 1] - lons[j])) : 0;
        gGrid[i][j] = Math.sqrt(dLatM * dLatM + dLonM * dLonM);
      }
    }
    return { lats, lons, grid: gGrid };
  }

  async function fetchBathyFromTiles(bb) {
    const z = pickTileZoom(bb.radiusNm);
    const n = Math.pow(2, z);
    const xMin = lonToTileX(bb.lonMin, z);
    const xMax = lonToTileX(bb.lonMax, z);
    const yMin = latToTileY(bb.latMax, z);
    const yMax = latToTileY(bb.latMin, z);
    const tiles = new Map();
    const loads = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        loads.push(loadTileImage(z, x, y).then(img => { tiles.set(x + ',' + y, img); }));
      }
    }
    await Promise.all(loads);

    const steps = TILE_GRID;
    const lats = [];
    const lons = [];
    for (let i = 0; i <= steps; i++) {
      lats.push(bb.latMin + (bb.latMax - bb.latMin) * i / steps);
      lons.push(bb.lonMin + (bb.lonMax - bb.lonMin) * i / steps);
    }
    const grid = Array.from({ length: lats.length }, () => Array(lons.length).fill(null));
    for (let i = 0; i < lats.length; i++) {
      for (let j = 0; j < lons.length; j++) {
        const lat = lats[i];
        const lon = lons[j];
        const tx = lonToTileX(lon, z);
        const ty = latToTileY(lat, z);
        const img = tiles.get(tx + ',' + ty);
        if (img) grid[i][j] = sampleTerrarium(img, lat, lon, z, tx, ty);
      }
    }
    const depth = { lats, lons, grid };
    return { depth, grad: computeGradGrid(depth), source: 'tiles', bb };
  }

  async function fetchGrid(dataset, variable, bb) {
    const lonMin = to360(bb.lonMin);
    const lonMax = to360(bb.lonMax);
    const url = ERDDAP + '/' + dataset + '.json?' + encodeURIComponent(variable) +
      '[(' + bb.latMin.toFixed(4) + '):(' + bb.latMax.toFixed(4) + ')]' +
      '[(' + lonMin.toFixed(4) + '):(' + lonMax.toFixed(4) + ')]';
    const j = await requestJSON(url, FETCH_MS);
    if (j && j.error) throw new Error(j.error.message || 'ERDDAP error');
    return parseGridTable(j);
  }

  function parseGridTable(j) {
    const rows = j?.table?.rows || [];
    const lats = [];
    const lons = [];
    const latIdx = new Map();
    const lonIdx = new Map();
    const vals = [];
    for (const row of rows) {
      const lat = row[0];
      let lon = row[1];
      lon = from360(lon);
      const v = row[2];
      if (!latIdx.has(lat)) { latIdx.set(lat, lats.length); lats.push(lat); }
      if (!lonIdx.has(lon)) { lonIdx.set(lon, lons.length); lons.push(lon); }
    }
    lats.sort((a, b) => a - b);
    lons.sort((a, b) => a - b);
    lats.forEach((lat, i) => latIdx.set(lat, i));
    lons.forEach((lon, i) => lonIdx.set(lon, i));
    const grid = Array.from({ length: lats.length }, () => Array(lons.length).fill(null));
    for (const row of rows) {
      const lat = row[0];
      let lon = from360(row[1]);
      const v = row[2];
      grid[latIdx.get(lat)][lonIdx.get(lon)] = v;
    }
    return { lats, lons, grid };
  }

  async function fetchBathyErddap(bb) {
    let depth = null;
    let grad = null;
    let source = DEPTH_DS;
    try {
      depth = await fetchGrid(DEPTH_DS, 'sea_floor_depth', bb);
      grad = await fetchGrid(DEPTH_DS, 'magnitude_gradient', bb);
    } catch (e) {
      source = DEPTH_FB;
      depth = await fetchGrid(DEPTH_FB, 'sea_floor_depth', bb);
      grad = await fetchGrid(DEPTH_FB, 'magnitude_gradient', bb);
    }
    return { depth, grad, source, bb };
  }

  async function fetchBathy(bb) {
    const key = cacheKey(bb.latMin + (bb.latMax - bb.latMin) / 2, bb.lonMin + (bb.lonMax - bb.lonMin) / 2, bb.radiusNm);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

    let data;
    try {
      data = await fetchBathyFromTiles(bb);
    } catch (e) {
      console.warn('seafloor tiles failed, trying ERDDAP', e);
      data = await fetchBathyErddap(bb);
    }
    cache.set(key, { at: Date.now(), data });
    return data;
  }

  async function fetchKelp(lat, lon, radiusM) {
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
    const features = j?.features;
    return Array.isArray(features) ? features : [];
  }

  function depthMeters(raw) {
    if (raw == null || !isFinite(raw)) return null;
    if (raw <= 0) return -raw;
    return null;
  }

  function depthColor(depthM) {
    if (depthM == null) return '#8a7a5c';
    const ft = depthM * M2FT;
    for (let i = DEPTH_FT.length - 1; i >= 0; i--) {
      if (ft >= DEPTH_FT[i]) return DEPTH_COL[Math.min(i, DEPTH_COL.length - 1)];
    }
    return DEPTH_COL[0];
  }

  function depthFeet(depthM) {
    if (depthM == null || !isFinite(depthM)) return null;
    return Math.round(depthM * M2FT);
  }

  function project(lat, lon, centerLat, centerLon, size, radiusNm) {
    const dx = (lon - centerLon) * nmPerDegLon(centerLat);
    const dy = (centerLat - lat) * 60;
    const scale = (size / 2) / radiusNm;
    return { x: size / 2 + dx * scale, y: size / 2 + dy * scale };
  }

  function unproject(x, y, centerLat, centerLon, size, radiusNm) {
    const scale = (size / 2) / radiusNm;
    const dx = (x - size / 2) / scale;
    const dy = (size / 2 - y) / scale;
    return {
      lat: centerLat - dy / 60,
      lon: centerLon + dx / nmPerDegLon(centerLat)
    };
  }

  function sampleDepthGrid(depthGrid, lat, lon) {
    const { lats, lons, grid } = depthGrid;
    if (!lats.length || !lons.length) return null;
    if (lat < lats[0] || lat > lats[lats.length - 1] ||
        lon < lons[0] || lon > lons[lons.length - 1]) return null;
    let i = 0;
    while (i < lats.length - 2 && lats[i + 1] < lat) i++;
    let j = 0;
    while (j < lons.length - 2 && lons[j + 1] < lon) j++;
    const lat0 = lats[i];
    const lat1 = lats[i + 1];
    const lon0 = lons[j];
    const lon1 = lons[j + 1];
    const d00 = depthMeters(grid[i][j]);
    const d10 = depthMeters(grid[i + 1][j]);
    const d01 = depthMeters(grid[i][j + 1]);
    const d11 = depthMeters(grid[i + 1][j + 1]);
    const samples = [d00, d10, d01, d11].filter(v => v != null);
    if (!samples.length) return null;
    if (d00 == null || d10 == null || d01 == null || d11 == null) {
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    }
    const ty = lat1 === lat0 ? 0 : (lat - lat0) / (lat1 - lat0);
    const tx = lon1 === lon0 ? 0 : (lon - lon0) / (lon1 - lon0);
    return d00 * (1 - tx) * (1 - ty) + d10 * (1 - tx) * ty +
      d01 * tx * (1 - ty) + d11 * tx * ty;
  }

  function hillshadeAlpha(i, j, grid) {
    const d = depthMeters(grid[i]?.[j]);
    if (d == null) return 0;
    const dN = depthMeters(grid[i - 1]?.[j]) ?? d;
    const dS = depthMeters(grid[i + 1]?.[j]) ?? d;
    const dW = depthMeters(grid[i]?.[j - 1]) ?? d;
    const dE = depthMeters(grid[i]?.[j + 1]) ?? d;
    const dzdx = (dE - dW) * 0.5;
    const dzdy = (dS - dN) * 0.5;
    const shade = 0.5 + dzdx * 0.06 - dzdy * 0.06;
    return clamp(shade, 0.12, 0.42);
  }

  function inBbox(lat, lon, bb, pad) {
    pad = pad || 0;
    return lat >= bb.latMin - pad && lat <= bb.latMax + pad &&
      lon >= bb.lonMin - pad && lon <= bb.lonMax + pad;
  }

  /** Normalize COAST_GEO point ({ lat, lon } or [lat, lon]) to [lat, lon]. */
  function normCoastPt(p) {
    if (!p) return null;
    if (Array.isArray(p)) {
      const lat = p[0];
      const lon = p[1];
      return lat != null && lon != null && isFinite(lat) && isFinite(lon) ? [lat, lon] : null;
    }
    if (typeof p === 'object' && p.lat != null && p.lon != null &&
        isFinite(p.lat) && isFinite(p.lon)) {
      return [p.lat, p.lon];
    }
    return null;
  }

  /** COAST_GEO lines are { name, pts: [...] }; legacy callers may pass raw arrays. */
  function normCoastLine(line) {
    if (!line) return [];
    const raw = line.pts != null ? line.pts : line;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const p of raw) {
      const n = normCoastPt(p);
      if (n) out.push(n);
    }
    return out;
  }

  function coastSegments(bb) {
    const g = global.COAST_OVERLAY_LITE || global.COAST_GEO;
    const lines = (g && g.lines) || [];
    const out = [];
    const pad = (bb.latMax - bb.latMin) * 0.15;
    for (const line of lines) {
      const pts = normCoastLine(line);
      if (pts.length < 2) continue;
      const inView = pts.filter(p => inBbox(p[0], p[1], bb, pad));
      if (inView.length >= 2) out.push(pts);
    }
    return out;
  }

  function gradThreshold(gradGrid) {
    const vals = [];
    for (const row of gradGrid.grid) {
      for (const v of row) if (v != null && isFinite(v) && v > 0) vals.push(v);
    }
    if (!vals.length) return 0.02;
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length * 0.82)] || 0.015;
  }

  function contourSegments(depthGrid, levelM, bb, size, centerLat, centerLon, radiusNm) {
    const { lats, lons, grid } = depthGrid;
    const segs = [];
    for (let i = 0; i < lats.length - 1; i++) {
      for (let j = 0; j < lons.length - 1; j++) {
        const d00 = depthMeters(grid[i][j]);
        const d10 = depthMeters(grid[i + 1][j]);
        const d01 = depthMeters(grid[i][j + 1]);
        const d11 = depthMeters(grid[i + 1][j + 1]);
        if (d00 == null && d10 == null && d01 == null && d11 == null) continue;
        const corners = [
          { d: d00, lat: lats[i], lon: lons[j] },
          { d: d10, lat: lats[i + 1], lon: lons[j] },
          { d: d11, lat: lats[i + 1], lon: lons[j + 1] },
          { d: d01, lat: lats[i], lon: lons[j + 1] }
        ];
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const a = corners[k];
          const b = corners[(k + 1) % 4];
          if (a.d == null || b.d == null) continue;
          if ((a.d < levelM && b.d >= levelM) || (a.d >= levelM && b.d < levelM)) {
            const t = (levelM - a.d) / (b.d - a.d);
            const lat = a.lat + t * (b.lat - a.lat);
            const lon = a.lon + t * (b.lon - a.lon);
            pts.push(project(lat, lon, centerLat, centerLon, size, radiusNm));
          }
        }
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
      }
    }
    return segs;
  }

  function kelpPaths(features, centerLat, centerLon, size, radiusNm, bb) {
    const paths = [];
    if (!Array.isArray(features)) return paths;
    for (const f of features) {
      const g = f?.geometry;
      if (!g) continue;
      let polys = [];
      if (g.type === 'Polygon' && Array.isArray(g.coordinates)) polys = [g.coordinates];
      else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) polys = g.coordinates;
      for (const poly of polys) {
        if (!Array.isArray(poly) || !Array.isArray(poly[0])) continue;
        const ring = poly[0];
        if (ring.length < 3) continue;
        let visible = false;
        for (const c of ring) {
          if (inBbox(c[1], c[0], bb, 0.01)) { visible = true; break; }
        }
        if (!visible) continue;
        const d = ring.map(c => {
          const p = project(c[1], c[0], centerLat, centerLon, size, radiusNm);
          return f1(p.x) + ',' + f1(p.y);
        }).join(' L ');
        paths.push('M ' + d + ' Z');
      }
    }
    return paths;
  }

  function compassRose(size) {
    const cx = size - 36;
    const cy = 36;
    return '<g class="seafloor-compass" aria-hidden="true">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="rgba(6,10,16,.72)" stroke="rgba(200,210,220,.35)" stroke-width="1"/>' +
      '<polygon points="' + cx + ',' + (cy - 11) + ' ' + (cx - 4) + ',' + (cy + 6) + ' ' + cx + ',' + (cy + 2) + ' ' + (cx + 4) + ',' + (cy + 6) +
      '" fill="#e8f0f8"/>' +
      '<text x="' + cx + '" y="' + (cy - 14) + '" text-anchor="middle" fill="#e8f0f8" font-size="10" font-weight="700" font-family="ui-monospace,monospace">N</text>' +
      '</g>';
  }

  function textHalo(x, y, text, fill, size, anchor) {
    anchor = anchor || 'middle';
    const fs = size || 11;
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + anchor + '" fill="' + fill +
      '" font-size="' + fs + '" font-weight="700" font-family="ui-monospace,monospace" stroke="#060a10" stroke-width="3" paint-order="stroke">' +
      esc(text) + '</text>';
  }

  function buildSvg(data, kelp, opts) {
    const size = SVG_SIZE;
    const { bb, depth, grad, source } = data;
    const centerLat = opts.centerLat;
    const centerLon = opts.centerLon;
    const radiusNm = bb.radiusNm;
    const { lats, lons, grid } = depth;
    const gThr = grad ? gradThreshold(grad) : 0.02;

    let cells = '';
    let hillshade = '';
    for (let i = 0; i < lats.length - 1; i++) {
      for (let j = 0; j < lons.length - 1; j++) {
        const samples = [grid[i][j], grid[i + 1][j], grid[i][j + 1], grid[i + 1][j + 1]]
          .map(depthMeters).filter(v => v != null);
        if (!samples.length) continue;
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const p00 = project(lats[i], lons[j], centerLat, centerLon, size, radiusNm);
        const p11 = project(lats[i + 1], lons[j + 1], centerLat, centerLon, size, radiusNm);
        const w = Math.max(2, p11.x - p00.x + 1);
        const h = Math.max(2, p11.y - p00.y + 1);
        cells += '<rect x="' + f1(p00.x) + '" y="' + f1(p00.y) + '" width="' + f1(w) + '" height="' + f1(h) +
          '" fill="' + depthColor(avg) + '" stroke="none"/>';
        const hs = hillshadeAlpha(i, j, grid);
        if (hs > 0.14) {
          hillshade += '<rect x="' + f1(p00.x) + '" y="' + f1(p00.y) + '" width="' + f1(w) + '" height="' + f1(h) +
            '" fill="rgba(0,0,0,' + f1(hs) + ')" stroke="none"/>';
        }
        const gVal = grad?.grid?.[i]?.[j];
        if (gVal != null && gVal >= gThr && avg >= 3) {
          cells += '<rect x="' + f1(p00.x) + '" y="' + f1(p00.y) + '" width="' + f1(w) + '" height="' + f1(h) +
            '" fill="rgba(210,140,70,.38)" stroke="rgba(255,190,110,.25)" stroke-width="0.5"/>';
        }
      }
    }

    let contours = '';
    let contourLabels = '';
    for (const ft of CONTOUR_FT) {
      const lv = ft / M2FT;
      const major = CONTOUR_LABEL_FT.has(ft);
      const segs = contourSegments(depth, lv, bb, size, centerLat, centerLon, radiusNm);
      for (const [a, b] of segs) {
        contours += '<line x1="' + f1(a.x) + '" y1="' + f1(a.y) + '" x2="' + f1(b.x) + '" y2="' + f1(b.y) +
          '" stroke="' + (major ? 'rgba(240,248,255,.55)' : 'rgba(240,244,248,.28)') +
          '" stroke-width="' + (major ? '1.4' : '0.9') + '"' +
          (major ? '' : ' stroke-dasharray="3 3"') + '/>';
      }
      if (major && segs.length) {
        let best = segs[0];
        let bestLen = 0;
        for (const seg of segs) {
          const len = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
          if (len > bestLen) { bestLen = len; best = seg; }
        }
        const mx = (best[0].x + best[1].x) / 2;
        const my = (best[0].y + best[1].y) / 2;
        const ang = Math.atan2(best[1].y - best[0].y, best[1].x - best[0].x) * 180 / Math.PI;
        contourLabels += '<g transform="translate(' + f1(mx) + ',' + f1(my) + ') rotate(' + f1(ang) + ')">' +
          '<rect x="-16" y="-8" width="32" height="14" rx="3" fill="rgba(6,10,16,.75)"/>' +
          '<text x="0" y="3" text-anchor="middle" fill="rgba(230,240,255,.9)" font-size="9" font-weight="600" font-family="ui-monospace,monospace">' +
          ft + ' ft</text></g>';
      }
    }

    let shore = '';
    for (const line of coastSegments(bb)) {
      let d = '';
      let started = false;
      for (const pt of line) {
        if (!inBbox(pt[0], pt[1], bb, 0.02)) {
          if (started) { shore += '" fill="none" stroke="#8a9aaa" stroke-width="2.5"/>'; d = ''; started = false; }
          continue;
        }
        const p = project(pt[0], pt[1], centerLat, centerLon, size, radiusNm);
        d += (started ? ' L ' : 'M ') + f1(p.x) + ' ' + f1(p.y);
        started = true;
      }
      if (started) shore += '<path d="' + d + '" fill="none" stroke="#8a9aaa" stroke-width="2.5"/>';
    }

    const kelpPathList = kelpPaths(kelp, centerLat, centerLon, size, radiusNm, bb);
    let kelpSvg = '';
    for (const p of kelpPathList) {
      kelpSvg += '<path d="' + p + '" fill="rgba(35,175,85,.48)" stroke="rgba(120,255,150,.65)" stroke-width="1.2"/>';
    }

    const boat = project(centerLat, centerLon, centerLat, centerLon, size, radiusNm);
    let marks = '<g class="seafloor-boat">' +
      '<circle cx="' + f1(boat.x) + '" cy="' + f1(boat.y) + '" r="9" fill="#3dd6f5" stroke="#060a10" stroke-width="2.5"/>' +
      textHalo(boat.x, boat.y - 16, 'YOU', '#3dd6f5', 12) + '</g>';

    if (opts.markLat != null && opts.markLon != null) {
      const dist = Math.hypot(
        (opts.markLat - centerLat) * 60,
        (opts.markLon - centerLon) * nmPerDegLon(centerLat)
      );
      if (dist > 0.08) {
        const mk = project(opts.markLat, opts.markLon, centerLat, centerLon, size, radiusNm);
        const markText = opts.markLabel ? String(opts.markLabel).slice(0, 14) : 'MARK';
        marks += '<g class="seafloor-mark">' +
          '<circle cx="' + f1(mk.x) + '" cy="' + f1(mk.y) + '" r="8" fill="#ffd966" stroke="#060a10" stroke-width="2"/>' +
          textHalo(mk.x, mk.y - 15, markText, '#ffd966', 11) + '</g>';
      }
    }

    const rings = [0.5, 1, 1.5, 2].filter(r => r <= radiusNm + 0.01).map(r => {
      const px = (r / radiusNm) * (size / 2);
      const lx = size / 2 + px + 6;
      const ly = size / 2 + 4;
      return '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + f1(px) +
        '" fill="none" stroke="rgba(240,244,248,.14)" stroke-width="1" stroke-dasharray="5 4"/>' +
        '<g transform="translate(' + f1(lx) + ',' + f1(ly) + ')">' +
        '<rect x="-2" y="-10" width="' + (Number.isInteger(r) ? 32 : 38) + '" height="14" rx="3" fill="rgba(6,10,16,.7)"/>' +
        '<text x="4" y="1" fill="rgba(210,220,230,.85)" font-size="9" font-weight="600" font-family="ui-monospace,monospace">' +
        r + ' nm</text></g>';
    }).join('');

    const legend =
      '<span class="seafloor-legend-title">Depth</span>' +
      DEPTH_FT.map((ft, i) =>
        '<span><i style="background:' + DEPTH_COL[i] + '"></i>' +
        (i === DEPTH_FT.length - 1 ? ft + '+ ft' : ft + '–' + DEPTH_FT[i + 1] + ' ft') + '</span>'
      ).join('') +
      '<span class="seafloor-legend-break"></span>' +
      '<span><i style="background:rgba(35,175,85,.65)"></i>Kelp bed</span>' +
      '<span><i style="background:rgba(210,140,70,.65)"></i>Reef / hard bottom</span>' +
      '<span><i style="background:#8a7a5c"></i>Land / no data</span>';

    const centerDepth = sampleDepthGrid(depth, centerLat, centerLon);
    const markDepth = opts.markLat != null ? sampleDepthGrid(depth, opts.markLat, opts.markLon) : null;

    const dsLabel = source === 'tiles'
      ? TILE_SOURCE
      : (source === DEPTH_DS ? 'NOAA SRTM30+ via ERDDAP (~0.5 nm)' : 'NOAA ETOPO via ERDDAP (~1 nm)');

    let depthSummary = 'YOU ~' + (depthFeet(centerDepth) != null ? depthFeet(centerDepth) + ' ft' : '—');
    if (markDepth != null && opts.markLat != null) {
      depthSummary += ' · MARK ~' + (depthFeet(markDepth) != null ? depthFeet(markDepth) + ' ft' : '—');
    }

    return {
      svg:
        '<svg class="seafloor-svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Seafloor bathymetry centered on vessel">' +
        '<rect width="' + size + '" height="' + size + '" fill="#081018"/>' +
        rings +
        cells +
        hillshade +
        kelpSvg +
        contours +
        contourLabels +
        shore +
        marks +
        compassRose(size) +
        '</svg>',
      legend,
      meta: depthSummary + ' · ' + dsLabel + ' · ' + kelp.length + ' kelp bed' + (kelp.length === 1 ? '' : 's') +
        ' · ' + f1(radiusNm) + ' nm · tap map for depth',
      depthGrid: depth,
      renderCtx: { centerLat, centerLon, size, radiusNm }
    };
  }

  function attachDepthProbe(host, depthGrid, renderCtx, metaEl, baseMeta) {
    const svg = host.querySelector('.seafloor-svg');
    if (!svg || !depthGrid) return;
    const probeId = 'seafloor-probe';
    let probeEl = host.querySelector('#' + probeId);
    if (!probeEl) {
      probeEl = document.createElement('div');
      probeEl.id = probeId;
      probeEl.className = 'seafloor-probe';
      host.appendChild(probeEl);
    }

    function showProbe(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (clientX - rect.left) / rect.width * renderCtx.size;
      const y = (clientY - rect.top) / rect.height * renderCtx.size;
      const geo = unproject(x, y, renderCtx.centerLat, renderCtx.centerLon, renderCtx.size, renderCtx.radiusNm);
      const dM = sampleDepthGrid(depthGrid, geo.lat, geo.lon);
      const dFt = depthFeet(dM);
      probeEl.textContent = dFt != null ? dFt + ' ft' : '—';
      probeEl.style.left = clamp(clientX - rect.left, 8, rect.width - 48) + 'px';
      probeEl.style.top = clamp(clientY - rect.top - 28, 4, rect.height - 24) + 'px';
      probeEl.hidden = false;
      if (metaEl) {
        metaEl.innerHTML = baseMeta.replace('tap map for depth', 'probe ' + (dFt != null ? dFt + ' ft' : '—'));
      }
    }

    function hideProbe() {
      probeEl.hidden = true;
      if (metaEl) metaEl.innerHTML = baseMeta;
    }

    svg.onmousemove = (e) => showProbe(e.clientX, e.clientY);
    svg.onmouseleave = hideProbe;
    svg.ontouchstart = (e) => {
      if (e.touches[0]) showProbe(e.touches[0].clientX, e.touches[0].clientY);
    };
    svg.ontouchend = () => setTimeout(hideProbe, 2200);
  }

  function setStatus(host, msg, err) {
    if (!host) return;
    host.innerHTML = '<div class="seafloor-status' + (err ? ' err' : '') + '">' + esc(msg) + '</div>';
  }

  async function loadAndRender(hostId, opts) {
    const host = typeof hostId === 'string' ? document.getElementById(hostId) : hostId;
    if (!host) return;
    const metaEl = opts.metaEl ? document.getElementById(opts.metaEl) : null;
    const reqId = (hosts.get(host)?.reqId || 0) + 1;
    hosts.set(host, { reqId, opts });
    setStatus(host, 'Loading bathymetry…');

    const centerLat = opts.centerLat;
    const centerLon = opts.centerLon;
    const radiusNm = opts.radiusNm || 2.5;
    const bb = bboxFromCenter(centerLat, centerLon, radiusNm);

    try {
      setStatus(host, 'Loading bathymetry tiles…');
      const bathyP = fetchBathy(bb);
      setStatus(host, 'Fetching kelp beds (CDFW)…');
      const kelpP = fetchKelp(centerLat, centerLon, radiusNm * 1852 * 1.05).catch(e => {
        console.warn('kelp fetch', e);
        return [];
      });
      const [bathy, kelp] = await Promise.all([bathyP, kelpP]);
      if (hosts.get(host)?.reqId !== reqId) return;

      setStatus(host, 'Rendering seafloor…');
      const built = buildSvg(bathy, kelp, { ...opts, centerLat, centerLon });
      const baseMeta = built.meta +
        (opts.habitat ? ' · <span class="seafloor-habitat">' + esc(opts.habitat) + '</span>' : '') +
        ' · <span class="seafloor-note">Model depths — verify on chart plotter before anchoring.</span>';
      host.innerHTML = built.svg + '<div class="seafloor-legend">' + built.legend + '</div>';
      attachDepthProbe(host, built.depthGrid, built.renderCtx, metaEl, baseMeta);
      if (metaEl) metaEl.innerHTML = baseMeta;
    } catch (e) {
      console.error('seafloor render', e);
      if (hosts.get(host)?.reqId !== reqId) return;
      setStatus(host, 'Could not load seafloor data: ' + (e.message || e), true);
      if (metaEl) metaEl.innerHTML = '';
    }
  }

  function init(deps) {
    fetchJSON = deps?.fetchJSON || fetchJSON;
  }

  function update(hostId, opts) {
    if (!fetchJSON && global.fetchJSON) fetchJSON = global.fetchJSON;
    loadAndRender(hostId, opts || {});
  }

  function refreshVisible() {
    for (const [host, st] of hosts) {
      if (host.isConnected && st.opts) loadAndRender(host, st.opts);
    }
  }

  global.SeafloorRender = { init, update, refreshVisible };
})(window);
