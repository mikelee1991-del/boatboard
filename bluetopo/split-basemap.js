/**
 * Split basemap: satellite imagery on land, NOAA BlueTopo (+ NCEI DEM) on water.
 *
 * Shoreline mask uses coast-overlay-lite.js:
 *   - alpha CSS mask (opaque = show water layers, transparent = land / imagery)
 *   - mainland: east-of-shoreline row punch (max coast lon at each lat)
 *   - islands + King Harbor land + inland boxes
 *
 * Not for navigation. No invented depths.
 *
 * Usage:
 *   await loadScript('bluetopo/split-basemap.js');
 *   BlueTopoSplit.attach(map, { maxZoom: 16, kingHarborLand: [...] });
 */
(function (global) {
  'use strict';

  const D2R = Math.PI / 180;
  const BLUETOPO_WMTS =
    'https://nowcoast.noaa.gov/geoserver/gwc/service/wmts/rest/bluetopo:hillshade/EPSG:3857/EPSG:3857:{z}/{y}/{x}?format=image/png8';
  const BLUETOPO_ATTR =
    'NOAA BlueTopo (NBS) © Office of Coast Survey — not for navigation';
  const NCEI_DEM_EXPORT =
    'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic_hillshade/ImageServer/exportImage';
  const NCEI_DEM_RENDER = encodeURIComponent(JSON.stringify({ rasterFunction: 'ColorHillshade' }));
  const NCEI_DEM_ATTR =
    'NOAA NCEI DEM ColorHillshade — coastal bathy/topo mosaic; not for navigation';
  const IMAGERY_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const IMAGERY_ATTR =
    'Imagery © Esri — Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community';
  /** Mask resolution vs map CSS pixels (lower = faster / smaller data-URL). */
  const MASK_SCALE = 0.5;

  function coastData() {
    return global.COAST_OVERLAY_LITE || null;
  }

  function shoreLonMaxAtLat(lat, lines) {
    if (!lines || !lines.length) return null;
    let maxLon = null;
    for (let li = 0; li < lines.length; li++) {
      const pts = lines[li].pts || lines[li];
      if (!pts || pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const lo = Math.min(a.lat, b.lat);
        const hi = Math.max(a.lat, b.lat);
        if (lat < lo || lat > hi) continue;
        const t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (lat - a.lat) / (b.lat - a.lat);
        const lon = a.lon + t * (b.lon - a.lon);
        if (maxLon == null || lon > maxLon) maxLon = lon;
      }
    }
    return maxLon;
  }

  function fillProjectedRing(ctx, map, ring, scale) {
    if (!ring || ring.length < 3) return;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const lat = p.lat != null ? p.lat : p[0];
      const lon = p.lon != null ? p.lon : (p.lng != null ? p.lng : p[1]);
      const pt = map.latLngToContainerPoint([lat, lon]);
      const x = pt.x * scale;
      const y = pt.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function fillInlandBoxes(ctx, map, scale) {
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

  /**
   * Alpha mask: opaque = show BlueTopo/DEM (water), transparent = land (imagery shows through).
   * Prior luminance + landward-extrude approach hid BlueTopo on most of the ocean.
   */
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

    /* Show water layers everywhere first. */
    ctx.clearRect(0, 0, mw, mh);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0, 0, mw, mh);

    /* Punch land to transparent so imagery underneath is visible. */
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';

    const g = opts.coast || coastData();
    const lines = g && g.lines;

    /* Mainland: east of westernmost… use max shore lon (matches app isEastOfShoreline). */
    if (lines && lines.length) {
      for (let y = 0; y < mh; y++) {
        const containerY = (y + 0.5) / scale;
        const ll = map.containerPointToLatLng([0, containerY]);
        const shoreLon = shoreLonMaxAtLat(ll.lat, lines);
        if (shoreLon == null) continue;
        const shoreX = map.latLngToContainerPoint([ll.lat, shoreLon]).x * scale;
        const x0 = Math.max(0, Math.floor(shoreX));
        if (x0 < mw) ctx.fillRect(x0, y, mw - x0 + 1, 1);
      }
    }

    if (g && g.islands) {
      for (let i = 0; i < g.islands.length; i++) {
        fillProjectedRing(ctx, map, g.islands[i].pts, scale);
      }
    }
    fillInlandBoxes(ctx, map, scale);
    if (opts.kingHarborLand && opts.kingHarborLand.length >= 3) {
      fillProjectedRing(ctx, map, opts.kingHarborLand, scale);
    }

    ctx.globalCompositeOperation = 'source-over';
    return canvas.toDataURL('image/png');
  }

  function applyMaskToPane(pane, dataUrl) {
    if (!pane || !dataUrl) return;
    /* Alpha channel drives visibility (not luminance). */
    pane.style.maskImage = 'url(' + dataUrl + ')';
    pane.style.webkitMaskImage = 'url(' + dataUrl + ')';
    pane.style.maskSize = '100% 100%';
    pane.style.webkitMaskSize = '100% 100%';
    pane.style.maskRepeat = 'no-repeat';
    pane.style.webkitMaskRepeat = 'no-repeat';
    pane.style.maskMode = 'alpha';
    pane.style.webkitMaskSourceType = 'alpha';
    pane.style.maskComposite = 'intersect';
  }

  function makeNceiDemLayer(L, paneName) {
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
      pane: paneName || 'blueTopoPane',
      maxZoom: 19,
      maxNativeZoom: 17,
      minZoom: 7,
      attribution: NCEI_DEM_ATTR,
      opacity: 1
    });
  }

  /**
   * Attach imagery (land) + masked DEM+BlueTopo (water).
   * @returns {{ imagery, blueTopo, dem, refresh, remove }}
   */
  function attach(map, opts) {
    opts = opts || {};
    if (!map || !global.L) throw new Error('BlueTopoSplit.attach requires a Leaflet map');
    const L = global.L;

    const maxZoom = opts.maxZoom != null ? opts.maxZoom : 16;
    map.getContainer().classList.add('ocean-map-dark', 'bt-split-basemap');
    if (!map.attributionControl) {
      L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    }

    if (!map.getPane('blueTopoPane')) {
      map.createPane('blueTopoPane');
    }
    const pane = map.getPane('blueTopoPane');
    /* Above tile pane (200), below overlay (400). Avoid competing with ::after at 350. */
    pane.style.zIndex = 360;
    pane.style.pointerEvents = 'none';

    const imagery = L.tileLayer(IMAGERY_URL, {
      maxZoom: maxZoom,
      minZoom: 3,
      attribution: IMAGERY_ATTR
    }).addTo(map);

    /* DEM underlay so water still shows relief where BlueTopo cells are undelivered (e.g. King Harbor). */
    const dem = makeNceiDemLayer(L, 'blueTopoPane');
    dem.addTo(map);

    const blueTopo = L.tileLayer(BLUETOPO_WMTS, {
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
      if (removed) return;
      if (!map.getSize || map.getSize().x < 4) return;
      try {
        /* Refresh coast pointer in case overlay loaded late. */
        maskOpts.coast = opts.coast || coastData();
        const url = paintMask(map, canvas, maskOpts);
        applyMaskToPane(pane, url);
        map.getContainer().setAttribute('data-bt-split', url ? '1' : '0');
      } catch (e) {
        console.warn('BlueTopoSplit mask', e);
        map.getContainer().setAttribute('data-bt-split', 'err');
      }
    }

    function schedule() {
      if (removed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 40);
    }

    map.on('moveend zoomend resize viewreset', schedule);
    map.whenReady(function () {
      refresh();
      setTimeout(refresh, 120);
      setTimeout(refresh, 400);
    });
    setTimeout(refresh, 0);
    setTimeout(refresh, 250);

    function remove() {
      removed = true;
      if (timer) clearTimeout(timer);
      map.off('moveend zoomend resize viewreset', schedule);
      try { map.removeLayer(blueTopo); } catch (e) { /* ignore */ }
      try { map.removeLayer(dem); } catch (e) { /* ignore */ }
      try { map.removeLayer(imagery); } catch (e) { /* ignore */ }
      pane.style.maskImage = '';
      pane.style.webkitMaskImage = '';
      map.getContainer().classList.remove('bt-split-basemap');
      map.getContainer().removeAttribute('data-bt-split');
    }

    return { imagery: imagery, blueTopo: blueTopo, dem: dem, refresh: refresh, remove: remove };
  }

  global.BlueTopoSplit = {
    attach: attach,
    BLUETOPO_WMTS: BLUETOPO_WMTS,
    IMAGERY_URL: IMAGERY_URL,
    version: '2'
  };
})(window);
