// Build coast-overlay-lite.js from OSM coastline ways (coast-osm-ways.js).
// Independent of coast-geo.js — no phantom chord patches.
// Preferred entry: powershell -File build-coast-overlay-lite.ps1
// Direct: cscript //Nologo build-coast-overlay-lite.js  (requires coast-osm-ways.js)
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
var NM = 1852;
var MAX_NM = 100;
var MIN_SPACING_M = 30; // ~100 ft
var GAP_SPLIT_M = 200;  // never densify across gaps larger than this

var ISLAND_BOXES = [
  { name: 'Santa Catalina Island', south: 33.28, west: -118.55, north: 33.48, east: -118.28 },
  { name: 'San Clemente Island', south: 32.87, west: -118.62, north: 33.15, east: -118.34 },
  { name: 'San Nicolas Island', south: 33.22, west: -119.75, north: 33.37, east: -119.44 },
  { name: 'Anacapa Island', south: 33.96, west: -119.40, north: 34.03, east: -119.30 },
  { name: 'Santa Cruz Island', south: 33.95, west: -119.80, north: 34.08, east: -119.34 },
  { name: 'Santa Rosa Island', south: 33.92, west: -120.18, north: 34.07, east: -119.80 }
];

if (!fso.FileExists(root + '\\coast-osm-ways.js')) {
  WScript.Echo('Missing coast-osm-ways.js — run: powershell -File build-coast-overlay-lite.ps1');
  WScript.Quit(1);
}
eval(readFile('coast-osm-ways.js'));
if (typeof COAST_OSM_WAYS === 'undefined' || !COAST_OSM_WAYS.length) {
  WScript.Echo('COAST_OSM_WAYS empty');
  WScript.Quit(1);
}

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearSlip(lat, lon) {
  return haversineM({ lat: SLIP_LAT, lon: SLIP_LON }, { lat: lat, lon: lon }) / NM <= MAX_NM;
}

function roundKey(p) {
  return p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
}

function roundPt(p) {
  return { lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5) };
}

function regionName(p) {
  var lat = p.lat, lon = p.lon;
  if (lat >= 33.68 && lat <= 33.84 && lon >= -118.48 && lon <= -118.30)
    return lat < 33.76 ? 'pv-south' : 'pv-north';
  if (lat >= 33.84 && lat <= 33.92 && lon >= -118.45 && lon <= -118.32) return 'south-bay';
  if (lat >= 33.92 && lat <= 34.05 && lon >= -118.85 && lon <= -118.45) return 'santa-monica';
  if (lat >= 33.55 && lat <= 33.72 && lon >= -118.05 && lon <= -117.55) return 'oc-south';
  if (lat >= 33.72 && lat <= 33.95 && lon >= -118.05 && lon <= -117.75) return 'oc-north';
  if (lon <= -118.85 && lat >= 33.95) return 'malibu';
  if (lon <= -119.0) return 'channel-coast';
  if (lat >= 33.70 && lat <= 33.80 && lon >= -118.30 && lon <= -118.15) return 'san-pedro';
  return 'coast-other';
}

function isClosed(chain, eps) {
  eps = eps || 0.0002;
  if (chain.length < 4) return false;
  var a = chain[0], b = chain[chain.length - 1];
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lon - b.lon) < eps;
}

function centroid(pts) {
  var lat = 0, lon = 0, i;
  for (i = 0; i < pts.length; i++) { lat += pts[i].lat; lon += pts[i].lon; }
  return { lat: lat / pts.length, lon: lon / pts.length };
}

function matchIsland(chain) {
  var c = centroid(chain), i, box;
  for (i = 0; i < ISLAND_BOXES.length; i++) {
    box = ISLAND_BOXES[i];
    if (c.lat >= box.south && c.lat <= box.north && c.lon >= box.west && c.lon <= box.east)
      return box.name;
  }
  return null;
}

function closeRing(pts) {
  if (pts.length < 3) return pts;
  var a = pts[0], b = pts[pts.length - 1];
  if (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6) return pts;
  return pts.concat([{ lat: a.lat, lon: a.lon }]);
}

function anyNearSlip(pts) {
  for (var i = 0; i < pts.length; i++) {
    if (nearSlip(pts[i].lat, pts[i].lon)) return true;
  }
  return false;
}

function decimate(pts, minM) {
  if (!pts || !pts.length) return [];
  var out = [pts[0]], i;
  for (i = 1; i < pts.length; i++) {
    if (haversineM(out[out.length - 1], pts[i]) >= minM) out.push(pts[i]);
  }
  var last = pts[pts.length - 1];
  if (out[out.length - 1].lat !== last.lat || out[out.length - 1].lon !== last.lon) out.push(last);
  return out;
}

/** Densify segments up to maxM; split (do not densify) when gap > gapSplitM. */
function subdivideMaxSplit(pts, maxM, gapSplitM) {
  if (!pts || pts.length < 2) return pts && pts.length ? [pts] : [];
  var segs = [], run = [pts[0]], i, a, b, d, n, k, t;
  for (i = 1; i < pts.length; i++) {
    a = run[run.length - 1];
    b = pts[i];
    d = haversineM(a, b);
    if (d > gapSplitM) {
      if (run.length >= 2) segs.push(run);
      run = [b];
      continue;
    }
    if (d <= maxM) { run.push(b); continue; }
    n = Math.ceil(d / maxM);
    for (k = 1; k <= n; k++) {
      t = k / n;
      run.push({
        lat: +(a.lat + (b.lat - a.lat) * t).toFixed(5),
        lon: +(a.lon + (b.lon - a.lon) * t).toFixed(5)
      });
    }
  }
  if (run.length >= 2) segs.push(run);
  return segs;
}

function clipAndResample(pts) {
  var segs = [], run = [], last = null, i, p, out = [], si, d, parts, pi;
  for (i = 0; i < pts.length; i++) {
    p = roundPt(pts[i]);
    if (!nearSlip(p.lat, p.lon)) {
      if (run.length >= 2) segs.push(run);
      run = [];
      last = null;
      continue;
    }
    if (last && haversineM(last, p) > GAP_SPLIT_M) {
      if (run.length >= 2) segs.push(run);
      run = [];
    }
    run.push(p);
    last = p;
  }
  if (run.length >= 2) segs.push(run);
  for (si = 0; si < segs.length; si++) {
    d = decimate(segs[si], MIN_SPACING_M);
    parts = subdivideMaxSplit(d, MIN_SPACING_M, GAP_SPLIT_M);
    for (pi = 0; pi < parts.length; pi++) {
      if (parts[pi].length >= 2) out.push(parts[pi]);
    }
  }
  return out;
}

function splitOpenChain(chain) {
  if (chain.length < 2) return [];
  var segments = [], curName = regionName(chain[0]), cur = [chain[0]], i, name;
  for (i = 1; i < chain.length; i++) {
    name = regionName(chain[i]);
    if (name !== curName && cur.length >= 2) {
      segments.push({ name: curName, pts: cur.slice() });
      cur = [chain[i - 1], chain[i]];
      curName = name;
    } else {
      cur.push(chain[i]);
    }
  }
  if (cur.length >= 2) segments.push({ name: curName, pts: cur });
  var counts = {}, named = [], s, n, suffix;
  for (i = 0; i < segments.length; i++) {
    s = segments[i];
    n = s.name;
    counts[n] = (counts[n] || 0) + 1;
    suffix = counts[n] > 1 ? ('-' + counts[n]) : '';
    named.push({ name: n + suffix, pts: s.pts });
  }
  return named;
}

function buildChains(ways) {
  var byHead = {}, byTail = {}, wi, w, list;
  for (wi = 0; wi < ways.length; wi++) {
    w = ways[wi];
    w.head = roundKey(w.pts[0]);
    w.tail = roundKey(w.pts[w.pts.length - 1]);
    if (!byHead[w.head]) byHead[w.head] = [];
    if (!byTail[w.tail]) byTail[w.tail] = [];
    byHead[w.head].push(w);
    byTail[w.tail].push(w);
  }
  var used = {}, chains = [], seed, chain, changed, hk, tk, cands, ci, wh, wt, i;
  for (wi = 0; wi < ways.length; wi++) {
    seed = ways[wi];
    if (used[seed.id]) continue;
    used[seed.id] = true;
    chain = seed.pts.slice();
    changed = true;
    while (changed) {
      changed = false;
      hk = roundKey(chain[0]);
      tk = roundKey(chain[chain.length - 1]);
      cands = (byHead[tk] || []).concat(byTail[tk] || []);
      for (ci = 0; ci < cands.length; ci++) {
        w = cands[ci];
        if (used[w.id]) continue;
        wh = w.head; wt = w.tail;
        if (tk === wh) {
          for (i = 1; i < w.pts.length; i++) chain.push(w.pts[i]);
          used[w.id] = true; changed = true; break;
        }
        if (tk === wt) {
          for (i = w.pts.length - 2; i >= 0; i--) chain.push(w.pts[i]);
          used[w.id] = true; changed = true; break;
        }
      }
      if (changed) continue;
      cands = (byHead[hk] || []).concat(byTail[hk] || []);
      for (ci = 0; ci < cands.length; ci++) {
        w = cands[ci];
        if (used[w.id]) continue;
        wh = w.head; wt = w.tail;
        if (hk === wt) {
          for (i = w.pts.length - 2; i >= 0; i--) chain.unshift(w.pts[i]);
          used[w.id] = true; changed = true; break;
        }
        if (hk === wh) {
          for (i = 1; i < w.pts.length; i++) chain.unshift(w.pts[i]);
          used[w.id] = true; changed = true; break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

WScript.Echo('OSM ways: ' + COAST_OSM_WAYS.length);
var chains = buildChains(COAST_OSM_WAYS);
WScript.Echo('Chains: ' + chains.length);

var lite = { lines: [], islands: [] };
var islandBest = {};
var ci, chain, islandName, segs, si, parts, pi, name, ring, best, bi;

for (ci = 0; ci < chains.length; ci++) {
  chain = chains[ci];
  islandName = matchIsland(chain);
  // Prefer any substantial chain whose centroid sits in an island box (closed or open OSM ring).
  if (islandName && chain.length >= 80) {
    if (!islandBest[islandName] || chain.length > islandBest[islandName].length)
      islandBest[islandName] = chain;
    continue;
  }
  if (isClosed(chain)) continue; // skip lagoons / harbor rings

  segs = splitOpenChain(chain);
  for (si = 0; si < segs.length; si++) {
    parts = clipAndResample(segs[si].pts);
    for (pi = 0; pi < parts.length; pi++) {
      name = segs[si].name;
      if (parts.length > 1) name = segs[si].name + '-' + pi;
      lite.lines.push({ name: name, pts: parts[pi] });
    }
  }
}

for (islandName in islandBest) {
  if (!islandBest.hasOwnProperty(islandName)) continue;
  ring = closeRing(islandBest[islandName]);
  if (!anyNearSlip(ring)) continue;
  // Islands: keep full ring (do not NearSlip-clip individual vertices — that tears the loop).
  // Use a larger gap threshold so sparse OSM sections don't shatter the outline.
  var ISLE_GAP_M = 1500;
  var iRing = [], rj;
  for (rj = 0; rj < ring.length; rj++) iRing.push(roundPt(ring[rj]));
  var iDec = decimate(iRing, MIN_SPACING_M);
  var iParts = subdivideMaxSplit(iDec, MIN_SPACING_M, ISLE_GAP_M);
  best = null;
  for (bi = 0; bi < iParts.length; bi++) {
    if (!best || iParts[bi].length > best.length) best = iParts[bi];
  }
  if (best && best.length >= 3) {
    var ia = best[0], ib = best[best.length - 1];
    if (haversineM(ia, ib) <= ISLE_GAP_M)
      lite.islands.push({ name: islandName, pts: closeRing(best) });
    else
      lite.islands.push({ name: islandName, pts: best });
  }
}

lite.lines.sort(function (a, b) {
  return b.pts[0].lat - a.pts[0].lat || a.pts[0].lon - b.pts[0].lon;
});

var totalPts = 0, li, maxSeg = 0, i, d;
for (li = 0; li < lite.lines.length; li++) totalPts += lite.lines[li].pts.length;
for (li = 0; li < lite.islands.length; li++) totalPts += lite.islands[li].pts.length;

function scanMax(pts) {
  for (i = 1; i < pts.length; i++) {
    d = haversineM(pts[i - 1], pts[i]);
    if (d > maxSeg) maxSeg = d;
  }
}
for (li = 0; li < lite.lines.length; li++) scanMax(lite.lines[li].pts);
for (li = 0; li < lite.islands.length; li++) scanMax(lite.islands[li].pts);

function escStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function ptOut(p) { return '{lat:' + p.lat + ',lon:' + p.lon + '}'; }
function lineOut(l) {
  var ptx = [], pi;
  for (pi = 0; pi < l.pts.length; pi++) ptx.push(ptOut(l.pts[pi]));
  return '{name:"' + escStr(l.name) + '",pts:[' + ptx.join(',') + ']}';
}

var body = 'window.COAST_OVERLAY_LITE = {lines:[';
for (li = 0; li < lite.lines.length; li++) {
  if (li) body += ',';
  body += lineOut(lite.lines[li]);
}
body += '],islands:[';
for (li = 0; li < lite.islands.length; li++) {
  if (li) body += ',';
  body += lineOut(lite.islands[li]);
}
body += ']};';

var js =
  '/* Map display coast -- OSM natural=coastline, ~100 ft, ~100 NM of King Harbor.\n' +
  ' * Regenerate: powershell -File build-coast-overlay-lite.ps1\n' +
  ' * Optional refresh: powershell -File build-coast-overlay-lite.ps1 -Fetch\n' +
  ' * Source: coast-osm.json -> coast-osm-ways.js. Independent of coast-geo.js. */\n' +
  body + '\n';

fso.OpenTextFile(root + '\\coast-overlay-lite.js', 2, true).Write(js);
var kb = Math.round(fso.GetFile(root + '\\coast-overlay-lite.js').Size / 1024);
WScript.Echo('coast-overlay-lite.js: ' + lite.lines.length + ' lines, ' +
  lite.islands.length + ' islands, ' + totalPts + ' pts, maxSeg=' +
  maxSeg.toFixed(1) + 'm, ' + kb + ' KB');
