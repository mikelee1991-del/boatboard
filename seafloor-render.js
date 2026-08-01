'use strict';
/*
 * On-site bathymetry chart (Fish + Dive + Fish Plan) — Leaflet.
 *
 * Tile sources (attribution on the map control):
 *   1. NOAA NCEI DEM ColorHillshade (ImageServer exportImage → Leaflet tiles)
 *      DEM_global_mosaic_hillshade — real shaded-relief bathy/topo (~few m cells).
 *      Default On site basemap when preferDem is set. CORS *.
 *   2. NOAA ENC Online WMS — chart soundings / schematic symbols (toggle).
 *   3. Esri World Ocean Base + Reference — regional tint (Plan default).
 *   4. OpenSeaMap seamarks · Esri World Imagery · CDFW kelp GeoJSON.
 *
 * Investigated / not shipped as default:
 *   - CUDEM DEM_tiles_mosaic — empty at SoCal King Harbor / PV / Catalina test AOIs
 *   - nowCOAST blended bathy — 403
 *   - OpenSeaMap depth XYZ — empty tiles at test coords
 *   - OpenWaters Seascape — Terrarium DEM + MVT contours (needs MapLibre/VectorGrid;
 *     not a drop-in image basemap). Contours max z14.
 *   - NOS hydro / multibeam MapServers — survey footprints only, not depth imagery
 *   - BlueTopo/NBS — best meter-scale source, but GeoTIFF download / self-host tiles
 *
 * Fit: On site ONSITE_FIT_FT = 1300 ft (~0.21 nm); Plan PLAN_FIT_NM = 2.5.
 * Not for navigation.
 */

(function (global) {
  const D2R = Math.PI / 180;
  const FT_PER_NM = 6076.12;
  /** On site default fit radius — local structure scale (hundreds–low thousands of feet). */
  const ONSITE_FIT_FT = 1300;                 // ~396 m
  const ONSITE_FIT_NM = ONSITE_FIT_FT / FT_PER_NM; // ~0.214 nm
  /** Nearby reef/kelp/rock pins on On site (slightly wider than fit). */
  const ONSITE_NEAR_NM = 0.32;                // ~1944 ft
  /** Fish Plan seafloor — wider context around the vessel. */
  const PLAN_FIT_NM = 2.5;
  const PLAN_NEAR_NM = 1.0;                   // ~6076 ft
  const KELP_QUERY = 'https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds3135_fpu/FeatureServer/0/query';
  const FETCH_MS = 20000;
  const KELP_CACHE_MS = 10 * 60 * 1000;

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
      try { st.map.remove(); } catch (e) { /* ignore */ }
      st.map = null;
      st.markers = null;
      st.kelpLayer = null;
      st.layersControl = null;
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
        return NCEI_DEM_EXPORT +
          '?bbox=' + bbox +
          '&bboxSR=3857&imageSR=3857&size=256,256&format=png32&f=image' +
          '&renderingRule=' + NCEI_DEM_RENDER;
      }
    });
    return new NceiDem('', {
      maxZoom: 19,
      maxNativeZoom: 17,
      minZoom: 8,
      attribution: NCEI_DEM_ATTR,
      opacity: 1
    });
  }

  function addBaseLayers(map, opts) {
    const preferDem = !!opts.preferDem;
    const preferEnc = !preferDem && !!opts.preferEnc;
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
    const seamarks = L.tileLayer(SEAMARK_URL, {
      maxZoom: 18,
      minZoom: 9,
      attribution: SEAMARK_ATTR,
      opacity: 0.9
    });
    const dem = makeNceiDemLayer();
    /* ENC WMS: one GetMap per Leaflet tile — fine at On site zoom (few tiles). */
    const enc = L.tileLayer.wms(ENC_WMS, {
      layers: ENC_LAYERS,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      attribution: ENC_ATTR,
      maxZoom: 19,
      minZoom: 11,
      opacity: 1,
      uppercase: true
    });

    function ensureFallback(removeLayer) {
      if (map.hasLayer(removeLayer)) map.removeLayer(removeLayer);
      if (!map.hasLayer(dem) && !map.hasLayer(enc) && !map.hasLayer(oceanGroup) && !map.hasLayer(imagery)) {
        oceanGroup.addTo(map);
      }
    }

    let demErr = 0; let demFb = false;
    dem.on('tileerror', () => {
      demErr++;
      if (demFb || demErr < 6) return;
      demFb = true;
      ensureFallback(dem);
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
      if (!map.hasLayer(imagery) && !map.hasLayer(dem) && !map.hasLayer(enc)) imagery.addTo(map);
    });

    const bases = {
      'NCEI DEM relief': dem,
      'NOAA ENC detail': enc,
      'Ocean chart': oceanGroup,
      'Satellite': imagery
    };
    if (preferDem) dem.addTo(map);
    else if (preferEnc) enc.addTo(map);
    else oceanGroup.addTo(map);
    seamarks.addTo(map);

    const overlays = { 'Seamarks': seamarks };
    const layersControl = L.control.layers(bases, overlays, {
      position: 'topright',
      collapsed: true
    }).addTo(map);

    return { oceanGroup, imagery, seamarks, enc, dem, layersControl };
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
    const fitMax = opts.fitMaxZoom != null ? opts.fitMaxZoom : (radiusNm <= 0.5 ? 18 : 15);
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

      const preferDem = opts.preferDem === true ||
        (opts.preferDem !== false && opts.preferEnc !== true &&
          (opts.radiusNm == null || opts.radiusNm <= 0.5));
      const preferEnc = !preferDem && (opts.preferEnc === true);
      const mode = preferDem ? 'dem' : (preferEnc ? 'enc' : 'ocean');
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
          scrollWheelZoom: true,
          tapTolerance: 18
        });
        L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(st.map);
        if (preferDem) {
          mapEl.classList.add('seafloor-leaflet', 'seafloor-dem');
        } else if (preferEnc) {
          mapEl.classList.add('seafloor-leaflet', 'seafloor-enc');
        } else {
          mapEl.classList.add('ocean-map-dark', 'seafloor-leaflet');
        }
        addBaseLayers(st.map, { preferDem, preferEnc });
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
      const chartLbl = preferDem ? 'NCEI DEM relief + OpenSeaMap'
        : (preferEnc ? 'NOAA ENC detail + OpenSeaMap' : 'Esri Ocean Base + OpenSeaMap');
      const baseMeta =
        chartLbl + ' · pinch-zoom · ' +
        nearCount + ' nearby pin' + (nearCount === 1 ? '' : 's') +
        ' · ' + kelpCount + ' kelp bed' + (kelpCount === 1 ? '' : 's') +
        ' · ' + spanLbl +
        (opts.habitat ? ' · <span class="seafloor-habitat">' + esc(opts.habitat) + '</span>' : '') +
        ' · <span class="seafloor-note">Chart depths are approximate — verify on a plotter before anchoring. Not for navigation.</span>';
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
    FT_PER_NM,
    ONSITE_FIT_FT,
    ONSITE_FIT_NM,
    ONSITE_NEAR_NM,
    PLAN_FIT_NM,
    PLAN_NEAR_NM
  };
})(window);
