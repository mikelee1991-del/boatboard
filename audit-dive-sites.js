// Audit ALL location arrays — run: cscript //Nologo audit-dive-sites.js
// Also writes audit-all-locations.json (FISH_SPOTS, SURF_SPOTS, CDIP_BUOYS + DIVE_SITES)
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);

function readFile(name) {
  return fso.OpenTextFile(root + '\\' + name, 1).ReadAll();
}

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
if (!COAST_GEO.lines || !COAST_GEO.lines.length) {
  WScript.Echo('COAST_GEO load failed: lines=' + (COAST_GEO.lines ? COAST_GEO.lines.length : 'null'));
  WScript.Quit(1);
}

var diveSrc = readFile('dive-engine.js');
var m = diveSrc.match(/const DIVE_SITES = \[([\s\S]*?)\n  \];/);
if (!m) { WScript.Echo('parse fail'); WScript.Quit(1); }
var DIVE_SITES = eval('[' + m[1] + ']');

var D2R = Math.PI / 180, R2D = 180 / Math.PI;
var KING_HARBOR_BBOX = { latMin: 33.832, latMax: 33.856, lonMin: -118.407, lonMax: -118.386 };
var KING_HARBOR_LAND = [
  { lat: 33.833889, lon: -118.389444 }, { lat: 33.833889, lon: -118.378611 },
  { lat: 33.855000, lon: -118.378611 }, { lat: 33.855000, lon: -118.389444 },
  { lat: 33.851111, lon: -118.391667 }, { lat: 33.848611, lon: -118.392500 },
  { lat: 33.845000, lon: -118.392778 }, { lat: 33.841111, lon: -118.393056 },
  { lat: 33.837500, lon: -118.393333 }
];

function destPt(lat, lon, brgDeg, distM) {
  var R = 6371000, br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
  var nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  var nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
  return { lat: nla * R2D, lon: ((nlo * R2D + 540) % 360) - 180 };
}
/** Push coord seaward along face until west of nearest coastline segment (audit/init only). */
function ensureWaterCoord(lat, lon, faceDeg) {
  var face = faceDeg != null ? faceDeg : 270;
  var pushes = [40, 60, 80, 100, 120, 150, 200, 250, 300];
  for (var i = 0; i < pushes.length; i++) {
    var p = destPt(lat, lon, face, pushes[i]);
    var loc = localEastM(p.lat, p.lon);
    if (!isOnLand(p.lat, p.lon) && loc.eastM < -30) return { lat: p.lat, lon: p.lon, pushM: pushes[i] };
  }
  for (var w = 50; w <= 350; w += 50) {
    var p2 = destPt(lat, lon, 270, w);
    var loc2 = localEastM(p2.lat, p2.lon);
    if (!isOnLand(p2.lat, p2.lon) && loc2.eastM < -30) return { lat: p2.lat, lon: p2.lon, pushM: w, dir: 270 };
  }
  return { lat: lat, lon: lon, pushM: 0 };
}
function distToSegmentM(lat, lon, a, b) {
  var cos = Math.cos(lat * D2R);
  var ax = a.lon * cos, ay = a.lat, bx = b.lon * cos, by = b.lat, px = lon * cos, py = lat;
  var abx = bx - ax, aby = by - ay, apx = px - ax, apy = py - ay;
  var ab2 = abx * abx + aby * aby;
  var t = ab2 < 1e-18 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  var qx = ax + t * abx, qy = ay + t * aby;
  var dlat = lat - qy, dlon = (lon - qx / cos);
  return { distM: Math.sqrt(dlat * dlat + dlon * dlon) * 111320, qx: qx, qy: qy, cos: cos };
}
function getCoastSegments() {
  var segs = [], lines = coastLines();
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line) continue;
    var pts = line.pts || line;
    if (!pts) continue;
    for (var i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1], name: line.name });
  }
  return segs;
}
var COAST_SEGS = getCoastSegments();
function nearestSegment(lat, lon) {
  var best = 1e12, bestSeg = null, bestProj = null;
  for (var i = 0; i < COAST_SEGS.length; i++) {
    var r = distToSegmentM(lat, lon, COAST_SEGS[i].a, COAST_SEGS[i].b);
    if (r.distM < best) { best = r.distM; bestSeg = COAST_SEGS[i]; bestProj = r; }
  }
  return { distM: best, seg: bestSeg, proj: bestProj };
}
/** Positive = landward of nearest coast segment (bluff/trail). Negative = seaward. */
function localEastM(lat, lon) {
  var ns = nearestSegment(lat, lon);
  if (!ns.seg || ns.distM > 3000) return { eastM: 0, distM: Math.round(ns.distM), seg: '' };
  var seg = ns.seg, p = ns.proj;
  var tx = (seg.b.lon - seg.a.lon) * p.cos, ty = seg.b.lat - seg.a.lat;
  var tlen = Math.sqrt(tx * tx + ty * ty) || 1;
  tx /= tlen; ty /= tlen;
  var nx = -ty, ny = tx;
  var px = lon * p.cos - p.qx, py = lat - p.qy;
  var alongNormal = px * nx + py * ny;
  return { eastM: Math.round(-alongNormal * 111320), distM: Math.round(ns.distM), seg: seg.name };
}
function isOnCatalina(lat, lon) {
  var isles = coastIslands();
  for (var i = 0; i < isles.length; i++) {
    if (isles[i] && isles[i].name === 'Santa Catalina Island' && isles[i].pts && pointInPoly(lat, lon, isles[i].pts)) return true;
  }
  return lat >= 33.30 && lat <= 33.50 && lon <= -118.30 && lon >= -118.55;
}
function haversineM(lat1, lon1, lat2, lon2) {
  var R = 6371000, p = D2R;
  var a = Math.sin((lat2 - lat1) * p / 2) * Math.sin((lat2 - lat1) * p / 2) +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) * Math.sin((lon2 - lon1) * p / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
function pointInPoly(lat, lon, poly) {
  var inside = false, n = poly.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
function isNearKingHarbor(lat, lon) {
  return lat >= KING_HARBOR_BBOX.latMin && lat <= KING_HARBOR_BBOX.latMax &&
    lon >= KING_HARBOR_BBOX.lonMin && lon <= KING_HARBOR_BBOX.lonMax;
}
function coastLines() { return COAST_GEO.lines || []; }
function coastIslands() { return COAST_GEO.islands || []; }
function shoreLonCandidatesAtLat(lat) {
  var out = [], lines = coastLines();
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line) continue;
    var pts = line.pts || line;
    if (!pts || !pts.length) continue;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var lo = Math.min(a.lat, b.lat), hi = Math.max(a.lat, b.lat);
      if (lat < lo || lat > hi) continue;
      var t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (lat - a.lat) / (b.lat - a.lat);
      out.push(a.lon + t * (b.lon - a.lon));
    }
  }
  return out;
}
function bestShoreLonAtLat(lat) {
  var cands = shoreLonCandidatesAtLat(lat);
  if (!cands.length) return null;
  var mx = cands[0];
  for (var i = 1; i < cands.length; i++) if (cands[i] > mx) mx = cands[i];
  return mx;
}
function metersEastOfShoreline(lat, lon) {
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return 0;
  return (lon - shoreLon) * 111320 * Math.cos(lat * D2R);
}
function isInKingHarborLand(lat, lon) { return pointInPoly(lat, lon, KING_HARBOR_LAND); }
function isEastOfShoreline(lat, lon) {
  if (lat < 32.4 || lat > 35.2) return false;
  if (isNearKingHarbor(lat, lon)) return false;
  if (lon > -118.05 && lat >= 33.45 && lat <= 33.72) return false;
  if (lon > -117.35 && lat >= 32.5 && lat <= 33.05) return false;
  var isles = coastIslands();
  for (var i = 0; i < isles.length; i++) {
    if (isles[i] && isles[i].pts && pointInPoly(lat, lon, isles[i].pts)) return true;
  }
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return false;
  return lon > shoreLon + 0.00008;
}
function buildObstacles() {
  var out = [], isles = COAST_GEO.islands || [], lands = COAST_GEO.land || [];
  for (var i = 0; i < isles.length; i++) {
    var isle = isles[i];
    if (!isle || !isle.pts) continue;
    var poly = [];
    for (var j = 0; j < isle.pts.length; j++) poly.push({ lat: isle.pts[j].lat, lng: isle.pts[j].lon });
    out.push({ name: isle.name, type: 'island', poly: poly });
  }
  for (var k = 0; k < lands.length; k++) {
    var l = lands[k];
    if (!l || !l.pts) continue;
    var poly2 = [];
    for (var m2 = 0; m2 < l.pts.length; m2++) poly2.push({ lat: l.pts[m2].lat, lng: l.pts[m2].lon });
    out.push({ name: l.name, type: 'peninsula', poly: poly2 });
  }
  return out;
}
var OBSTACLES = buildObstacles();
function isOnLand(lat, lon) {
  if (isInKingHarborLand(lat, lon)) return true;
  if (isNearKingHarbor(lat, lon)) return false;
  if (lat >= 32.4 && lat <= 35.2 && lon >= -121.5 && lon <= -117.0) {
    if (isEastOfShoreline(lat, lon)) return true;
    for (var i = 0; i < OBSTACLES.length; i++) {
      var ob = OBSTACLES[i];
      if (ob.type !== 'peninsula' && ob.type !== 'point' && ob.type !== 'island') continue;
      var poly = [];
      for (var j = 0; j < ob.poly.length; j++) poly.push({ lat: ob.poly[j].lat, lon: ob.poly[j].lng });
      if (pointInPoly(lat, lon, poly)) return true;
    }
    return false;
  }
  return true;
}
function isLikelyOnWater(lat, lon) {
  if (isInKingHarborLand(lat, lon)) return false;
  if (isNearKingHarbor(lat, lon)) return true;
  if (lat < 32.4 || lat > 35.2 || lon > -117.0 || lon < -121.5) return false;
  if (lon > -118.05 && lat >= 33.45 && lat <= 33.72) return !isEastOfShoreline(lat, lon);
  if (lon > -117.35 && lat >= 32.5 && lat <= 33.05) return !isEastOfShoreline(lat, lon);
  var shoreLon = bestShoreLonAtLat(lat);
  if (shoreLon == null) return false;
  return lon < shoreLon - 0.00025;
}
function distToNearestShorelineM(lat, lon) {
  var best = 1e12, lines = coastLines();
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line) continue;
    var pts = line.pts || line;
    if (!pts) continue;
    for (var i = 0; i < pts.length; i++) {
      if (!pts[i]) continue;
      var d = haversineM(lat, lon, pts[i].lat, pts[i].lon);
      if (d < best) best = d;
    }
  }
  return best === 1e12 ? null : best;
}
function onIsland(lat, lon) {
  var isles = coastIslands();
  for (var i = 0; i < isles.length; i++) {
    if (isles[i] && isles[i].pts && pointInPoly(lat, lon, isles[i].pts)) return isles[i].name;
  }
  return '';
}
function isOCGap(lat, lon) {
  return (lon > -118.05 && lat >= 33.45 && lat <= 33.72) ||
    (lon > -117.35 && lat >= 32.5 && lat <= 33.05);
}
function verdict(site, onLand, mEast, onIsle) {
  var gap = isOCGap(site.lat, site.lon);
  var loc = isOnCatalina(site.lat, site.lon) ? { eastM: -999, distM: 0 } : localEastM(site.lat, site.lon);
  var bluff = !gap && !isOnCatalina(site.lat, site.lon) && loc.distM < 120 && loc.eastM > 80;
  if (site.boat) {
    if (onIsle) return 'FIX LOCATION';
    if (onLand || bluff || (mEast > 25 && !gap)) return 'FIX LOCATION';
    if (!isLikelyOnWater(site.lat, site.lon) && !gap && mEast > 0) return 'FIX LOCATION';
    return 'OK';
  }
  if (onLand || bluff || (mEast > 25 && !gap)) return 'FIX OFFSHORE';
  if (!isLikelyOnWater(site.lat, site.lon) && !gap && mEast > 0) return 'FIX OFFSHORE';
  if (mEast > 0 && mEast <= 25 && !gap) return 'FIX OFFSHORE';
  if (onLand === false && (isLikelyOnWater(site.lat, site.lon) || gap)) return 'OK';
  return 'OK';
}
function suggestOffshore(site) {
  var face = site.face || 270;
  var pushes = [40, 60, 80, 100, 120, 150, 200];
  for (var pi = 0; pi < pushes.length; pi++) {
    var m = pushes[pi], p = destPt(site.lat, site.lon, face, m);
    if (!isOnLand(p.lat, p.lon) && isLikelyOnWater(p.lat, p.lon)) {
      var me = metersEastOfShoreline(p.lat, p.lon);
      if (me <= 0 || (isOCGap(p.lat, p.lon) && me < 500)) return { lat: p.lat, lon: p.lon, pushM: m, dir: face };
    }
  }
  var west = [50, 100, 150, 200, 300];
  for (var wi = 0; wi < west.length; wi++) {
    var m2 = west[wi], p2 = destPt(site.lat, site.lon, 270, m2);
    if (!isOnLand(p2.lat, p2.lon) && isLikelyOnWater(p2.lat, p2.lon)) {
      return { lat: p2.lat, lon: p2.lon, pushM: m2, dir: 270 };
    }
  }
  return null;
}

var rows = [], ok = 0, fix = 0;
for (var si = 0; si < DIVE_SITES.length; si++) {
  var site = DIVE_SITES[si];
  var ol = isOnLand(site.lat, site.lon);
  var me = Math.round(metersEastOfShoreline(site.lat, site.lon));
  var loc = isOnCatalina(site.lat, site.lon) ? { eastM: -999, distM: 0, seg: 'catalina' } : localEastM(site.lat, site.lon);
  var ow = isLikelyOnWater(site.lat, site.lon);
  var sd = distToNearestShorelineM(site.lat, site.lon);
  var oi = onIsland(site.lat, site.lon);
  var v = verdict(site, ol, me, oi);
  var sug = v !== 'OK' ? suggestOffshore(site) : null;
  if (v === 'OK') ok++; else fix++;
  rows.push({
    id: site.id, name: site.name, boat: !!site.boat,
    lat: site.lat, lon: site.lon, onLand: ol, mEast: me, localEast: loc.eastM, onWater: ow,
    shoreDistM: sd != null ? Math.round(sd) : null, onIsle: oi, verdict: v,
    sugLat: sug ? Math.round(sug.lat * 1e6) / 1e6 : null,
    sugLon: sug ? Math.round(sug.lon * 1e6) / 1e6 : null,
    sugPush: sug ? (sug.pushM + 'm ' + sug.dir) : ''
  });
}

WScript.Echo('\n## Audit Summary: ' + ok + ' OK, ' + fix + ' need fix (' + DIVE_SITES.length + ' total)\n');
var LA_IDS = { veterans:1,kingharbor:1,torrance:1,hermosa:1,malaga:1,abalone:1,sacred:1,honeymoon:1,ptvicente:1,pvcaves:1,rockypoint:1,portuguese:1,lunada:1,whitepoint:1,golfball:1,yellowtail:1,horseshoe:1,barge287:1,palawan:1,ub88:1,casino:1,lovers:1,descanso:1,bluecavern:1,eaglereef:1,wreckavalon:1,shiprock:1,longpoint:1,henrock:1,arrowpoint:1,littleharbor:1,isthmus:1,emeraldbay:1,benweston:1,farnsworth:1,leo:1,ptdume:1,paradise:1 };
var laOk = 0, laFix = 0;
for (var li = 0; li < rows.length; li++) {
  if (!LA_IDS[rows[li].id]) continue;
  if (rows[li].verdict === 'OK') laOk++; else laFix++;
}
WScript.Echo('## LA basin subset: ' + laOk + ' OK, ' + laFix + ' need fix\n');
WScript.Echo('| id | name | lat | lon | onLand | mEast | localEast | onWater | shoreDistM | onIsle | verdict | suggested |');
WScript.Echo('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (var ri = 0; ri < rows.length; ri++) {
  var r = rows[ri];
  var sugStr = r.sugLat ? (r.sugLat + ', ' + r.sugLon + ' (' + r.sugPush + ')') : '';
  WScript.Echo('| ' + r.id + ' | ' + r.name + ' | ' + r.lat + ' | ' + r.lon + ' | ' + r.onLand + ' | ' + r.mEast + ' | ' + r.localEast + ' | ' + r.onWater + ' | ' + (r.shoreDistM != null ? r.shoreDistM : '—') + ' | ' + r.onIsle + ' | ' + r.verdict + ' | ' + sugStr + ' |');
}

var outPath = root + '\\audit-dive-sites.json';
var outFile = fso.CreateTextFile(outPath, true);
if(typeof JSON === 'undefined'){
  JSON = {
    stringify: function(v, repl, sp){
      var spc = typeof sp === 'number' ? Array(sp + 1).join(' ') : (sp || '');
      function ser(o, ind){
        if(o === null) return 'null';
        var t = typeof o;
        if(t === 'number' || t === 'boolean') return String(o);
        if(t === 'string') return '"' + String(o).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';
        if(Object.prototype.toString.call(o) === '[object Array]'){
          if(!o.length) return '[]';
          var a = [];
          for(var i = 0; i < o.length; i++) a.push(ser(o[i], ind + spc));
          return '[\n' + ind + spc + a.join(',\n' + ind + spc) + '\n' + ind + ']';
        }
        var p = [];
        for(var k in o) if(o.hasOwnProperty(k)) p.push('"' + k + '": ' + ser(o[k], ind + spc));
        return '{\n' + ind + spc + p.join(',\n' + ind + spc) + '\n' + ind + '}';
      }
      return ser(v, '');
    }
  };
}
outFile.Write(JSON.stringify({ summary: { ok: ok, fix: fix, total: DIVE_SITES.length }, rows: rows }, null, 2));
outFile.Close();
WScript.Echo('\nWrote audit-dive-sites.json');

/* —— Also audit FISH_SPOTS, SURF_SPOTS, CDIP_BUOYS from dashboard —— */
function extractDashArray(src, name) {
  var re = new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];');
  var m2 = src.match(re);
  if (!m2) return null;
  return eval('[' + m2[1] + ']');
}
var dashSrc = readFile('index.html');
var extraSets = [
  ['FISH_SPOTS', extractDashArray(dashSrc, 'FISH_SPOTS')],
  ['SURF_SPOTS', extractDashArray(dashSrc, 'SURF_SPOTS')],
  ['CDIP_BUOYS', extractDashArray(dashSrc, 'CDIP_BUOYS')]
];
var allRows = rows.slice();
var allSummary = { DIVE_SITES: { ok: ok, fix: fix, total: DIVE_SITES.length } };
  for (var ei = 0; ei < extraSets.length; ei++) {
  var cat = extraSets[ei][0], arr = extraSets[ei][1];
  if (!arr) { WScript.Echo('WARN: could not parse ' + cat); continue; }
  var cOk = 0, cFix = 0;
  WScript.Echo('\n## ' + cat + ' audit\n');
  WScript.Echo('| name | lat | lon | onLand | mEast | localEast | bluff | verdict | suggested |');
  WScript.Echo('|---|---|---|---|---|---|---|---|---|');
  for (var ai = 0; ai < arr.length; ai++) {
    var it = arr[ai];
    var id = it.id || it.name;
    var ol2 = isOnLand(it.lat, it.lon);
    var me2 = Math.round(metersEastOfShoreline(it.lat, it.lon));
    var loc2 = isOnCatalina(it.lat, it.lon) ? { eastM: -999, distM: 0 } : localEastM(it.lat, it.lon);
    var oi2 = onIsland(it.lat, it.lon);
    var gap2 = isOCGap(it.lat, it.lon);
    var bluff2 = !gap2 && !isOnCatalina(it.lat, it.lon) && loc2.distM < 120 && loc2.eastM > 80;
    var v2 = 'OK';
    if (ol2 && !gap2) v2 = 'FIX';
    else if (bluff2) v2 = 'FIX';
    else if (me2 > 25 && !gap2) v2 = 'FIX';
    else if (!isLikelyOnWater(it.lat, it.lon) && !gap2 && me2 > 0) v2 = 'FIX';
    if (v2 === 'OK') cOk++; else cFix++;
    var sug2 = v2 !== 'OK' ? ensureWaterCoord(it.lat, it.lon, it.face || 270) : null;
    var sugStr = sug2 ? (Math.round(sug2.lat * 1e6) / 1e6 + ', ' + Math.round(sug2.lon * 1e6) / 1e6 + ' (' + sug2.pushM + 'm)') : '';
    if (v2 !== 'OK') {
      WScript.Echo('  FIX: ' + id + ' ' + it.lat + ', ' + it.lon + ' onLand=' + ol2 + ' mEast=' + me2 + ' localEast=' + loc2.eastM + ' bluff=' + bluff2);
    }
    WScript.Echo('| ' + id + ' | ' + it.lat + ' | ' + it.lon + ' | ' + ol2 + ' | ' + me2 + ' | ' + loc2.eastM + ' | ' + bluff2 + ' | ' + v2 + ' | ' + sugStr + ' |');
    allRows.push({ category: cat, id: id, name: it.name, lat: it.lat, lon: it.lon, onLand: ol2, mEast: me2, localEast: loc2.eastM, bluff: bluff2, verdict: v2, sugLat: sug2 ? Math.round(sug2.lat * 1e6) / 1e6 : null, sugLon: sug2 ? Math.round(sug2.lon * 1e6) / 1e6 : null });
  }
  allSummary[cat] = { ok: cOk, fix: cFix, total: arr.length };
  WScript.Echo(cat + ': ' + cOk + ' OK, ' + cFix + ' need fix (' + arr.length + ' total)');
  if (cat === 'FISH_SPOTS') {
    var laFishOk = 0, laFishFix = 0;
    for (var fi = 0; fi < arr.length; fi++) {
      var fn = arr[fi].name || '';
      if (fn.indexOf('Catalina') >= 0 || fn.indexOf('Malibu') >= 0 || fn.indexOf('Newport') >= 0 || fn.indexOf('Huntington') >= 0 || fn.indexOf('Izor') >= 0 || fn.indexOf('Farnsworth') >= 0) continue;
      var fol = isOnLand(arr[fi].lat, arr[fi].lon);
      var floc = localEastM(arr[fi].lat, arr[fi].lon);
      var fbluff = floc.distM < 120 && floc.eastM > 80;
      var fgap = isOCGap(arr[fi].lat, arr[fi].lon);
      var fme = Math.round(metersEastOfShoreline(arr[fi].lat, arr[fi].lon));
      var fv = (fol && !fgap) || fbluff || (fme > 25 && !fgap) ? 'FIX' : 'OK';
      if (fv === 'OK') laFishOk++; else laFishFix++;
    }
    WScript.Echo('## LA basin fish subset: ' + laFishOk + ' OK, ' + laFishFix + ' need fix');
  }
}
var allOut = root + '\\audit-all-locations.json';
var allFile = fso.CreateTextFile(allOut, true);
allFile.Write(JSON.stringify({ summary: allSummary, rows: allRows }, null, 2));
allFile.Close();
WScript.Echo('\nWrote audit-all-locations.json');
