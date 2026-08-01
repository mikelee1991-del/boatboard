/**
 * Split basemap: Esri World Imagery on land, NOAA BlueTopo hillshade on water.
 * Shoreline split uses coast-overlay-lite.js (OSM) — landward extrude from coast
 * segments + island polygons + King Harbor land. Not for navigation.
 *
 * Usage:
 *   await loadScript('bluetopo/split-basemap.js');
 *   BlueTopoSplit.attach(map, { maxZoom: 16 });
 */
(function (global) {
  'use strict';

  const D2R = Math.PI / 180;
  const BLUETOPO_WMTS =
    'https://nowcoast.noaa.gov/geoserver/gwc/service/wmts/rest/bluetopo:hillshade/EPSG:3857/EPSG:3857:{z}/{y}/{x}?format=image/png8';
  const BLUETOPO_ATTR =
    'NOAA BlueTopo (NBS) © Office of Coast Survey — not for navigation';
  const IMAGERY_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const IMAGERY_ATTR =
    'Imagery © Esri — Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community';
  /** How far inland to paint the land mask from each coast segment (meters). */
  const LANDWARD_M = 90000;
  const MASK_SCALE = 0.55;

  function coastData() {
    return global.COAST_OVERLAY_LITE || null;
  }

  function landwardDelta(a, b, distM) {
    const cos = Math.cos(((a.lat + b.lat) / 2) * D2R);
    const dx = (b.lon - a.lon) * cos;
    const dy = b.lat - a.lat;
    const len = Math.hypot(dx, dy) || 1;
    /* OSM coastline: water on the right → land on the left. */
    const nx = -dy / len;
    const ny = dx / len;
    return {
      dLat: (ny * distM) / 111320,
      dLon: (nx * distM) / (111320 * Math.max(0.2, cos))
    };
  }

  function fillProjectedRing(ctx, map, ring, scale) {
    if (!ring || ring.length < 3) return;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const lat = p.lat != null ? p.lat : p[0];
      const lon = p.lon != null ? p.lon : p.lng != null ? p.lng : p[1];
      const pt = map.latLngToContainerPoint([lat, lon]);
      const x = pt.x * scale;
      const y = pt.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function fillLandwardStrips(ctx, map, lines, scale) {
    if (!lines || !lines.length) return;
    for (let li = 0; li < lines.length; li++) {
      const pts = lines[li].pts || lines[li];
      if (!pts || pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (a == null || b == null) continue;
        const off = landwardDelta(a, b, LANDWARD_M);
        const a2 = { lat: a.lat + off.dLat, lon: a.lon + off.dLon };
        const b2 = { lat: b.lat + off.dLat, lon: b.lon + off.dLon };
        fillProjectedRing(ctx, map, [a, b, b2, a2], scale);
      }
    }
  }

  function fillInlandBoxes(ctx, map, scale) {
    /* Same conservative boxes as isClearlyInlandHeuristic in index.html */
    const boxes = [
      [[33.70, -118.20], [34.30, -116.90]],
      [[33.82, -118.35], [34.12, -118.20]],
      [[33.45, -117.85], [33.90, -116.90]],
      [[32.55, -117.15], [33.15, -116.90]]
    ];
    for (let i = 0; i < boxes.length; i++) {
      const sw = boxes[i][0];
      const ne = boxes[i][1];
      fillProjectedRing(ctx, map, [
        { lat: sw[0], lon: sw[1] },
        { lat: sw[0], lon: ne[1] },
        { lat: ne[0], lon: ne[1] },
        { lat: ne[0], lon: sw[1] }
      ], scale);
    }
  }

  function paintMask(map, canvas, opts) {
    const size = map.getSize();
    const w = size.x;
    const h = size.y;
    if (w < 4 || h < 4) return null;
    const scale = MASK_SCALE;
    const mw = Math.max(2, Math.round(w * scale));
    const mh = Math.max(2, Math.round(h * scale));
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    /* Luminance mask: white = show BlueTopo (water), black = hide (land → imagery). */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, mw, mh);
    ctx.fillStyle = '#000000';

    const g = opts.coast || coastData();
    if (g) {
      fillLandwardStrips(ctx, map, g.lines, scale);
      const isles = g.islands || [];
      for (let i = 0; i < isles.length; i++) {
        fillProjectedRing(ctx, map, isles[i].pts, scale);
      }
    }
    fillInlandBoxes(ctx, map, scale);
    if (opts.kingHarborLand && opts.kingHarborLand.length >= 3) {
      fillProjectedRing(ctx, map, opts.kingHarborLand, scale);
    }
    return canvas.toDataURL('image/png');
  }

  function applyMaskToPane(pane, dataUrl) {
    if (!pane || !dataUrl) return;
    pane.style.maskImage = 'url(' + dataUrl + ')';
    pane.style.webkitMaskImage = 'url(' + dataUrl + ')';
    pane.style.maskSize = '100% 100%';
    pane.style.webkitMaskSize = '100% 100%';
    pane.style.maskRepeat = 'no-repeat';
    pane.style.webkitMaskRepeat = 'no-repeat';
    pane.style.maskMode = 'luminance';
    pane.style.webkitMaskSourceType = 'luminance';
  }

  /**
   * Attach imagery (land) + masked BlueTopo (water) as default basemap.
   * @returns {{ imagery, blueTopo, refresh, remove }}
   */
  function attach(map, opts) {
    opts = opts || {};
    if (!map || !global.L) throw new Error('BlueTopoSplit.attach requires a Leaflet map');

    const maxZoom = opts.maxZoom != null ? opts.maxZoom : 16;
    map.getContainer().classList.add('ocean-map-dark', 'bt-split-basemap');
    if (!map.attributionControl) {
      global.L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    }

    if (!map.getPane('blueTopoPane')) {
      map.createPane('blueTopoPane');
    }
    const pane = map.getPane('blueTopoPane');
    pane.style.zIndex = 350;
    pane.style.pointerEvents = 'none';

    const imagery = global.L.tileLayer(IMAGERY_URL, {
      maxZoom: maxZoom,
      minZoom: 3,
      attribution: IMAGERY_ATTR
    }).addTo(map);

    const blueTopo = global.L.tileLayer(BLUETOPO_WMTS, {
      pane: 'blueTopoPane',
      maxZoom: 19,
      maxNativeZoom: 18,
      minZoom: 7,
      opacity: 1,
      attribution: BLUETOPO_ATTR
    }).addTo(map);

    const canvas = document.createElement('canvas');
    let timer = null;
    let removed = false;

    const maskOpts = {
      coast: opts.coast || coastData(),
      kingHarborLand: opts.kingHarborLand || null
    };

    function refresh() {
      if (removed || !map._loaded) return;
      try {
        const url = paintMask(map, canvas, maskOpts);
        applyMaskToPane(pane, url);
      } catch (e) {
        console.warn('BlueTopoSplit mask', e);
      }
    }

    function schedule() {
      if (removed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 60);
    }

    map.on('moveend zoomend resize viewreset', schedule);
    /* First paint after tiles have a size */
    setTimeout(refresh, 0);
    setTimeout(refresh, 200);

    function remove() {
      removed = true;
      if (timer) clearTimeout(timer);
      map.off('moveend zoomend resize viewreset', schedule);
      try { map.removeLayer(blueTopo); } catch (e) { /* ignore */ }
      try { map.removeLayer(imagery); } catch (e) { /* ignore */ }
      pane.style.maskImage = '';
      pane.style.webkitMaskImage = '';
      map.getContainer().classList.remove('bt-split-basemap');
    }

    return { imagery: imagery, blueTopo: blueTopo, refresh: refresh, remove: remove };
  }

  global.BlueTopoSplit = {
    attach: attach,
    BLUETOPO_WMTS: BLUETOPO_WMTS,
    IMAGERY_URL: IMAGERY_URL
  };
})(window);
