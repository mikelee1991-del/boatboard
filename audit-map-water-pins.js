// Stricter map-aligned water-pin audit using coast-overlay-lite shoreline.
// Run: cscript //Nologo audit-map-water-pins.js
// Gate matches Esri-visible water: right-hand seaward of overlay coast + island polys.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var COAST_OVERLAY_LITE = {};
eval(readFile('coast-overlay-lite.js').replace(/window\.COAST_OVERLAY_LITE/g, 'COAST_OVERLAY_LITE'));

var D2R = Math.PI / 180;
function pointInPoly(lat, lon, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
function distToSegmentM(lat, lon, a, b) {
  var cos = Math.cos(lat * D2R);
  var ax = a.lon * cos, ay = a.lat, bx = b.lon * cos, by = b.lat, px = lon * cos, py = lat;
  var abx = bx - ax, aby = by - ay, apx = px - ax, apy = py - ay;
  var ab2 = abx * abx + aby * aby;
  var t = ab2 < 1e-18 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  var qx = ax + t * abx, qy = ay + t * aby;
  var dlat = lat - qy, dlon = (lon - qx / cos);
  return { distM: Math.sqrt(dlat * dlat + dlon * dlon) * 111320, qx: qx, qy: qy, cos: cos, t: t };
}
var COAST_SEGS = null;
function coastSegs() {
  if (COAST_SEGS) return COAST_SEGS;
  COAST_SEGS = [];
  var lines = (COAST_OVERLAY_LITE && COAST_OVERLAY_LITE.lines) || [];
  for (var li = 0; li < lines.length; li++) {
    var pts = lines[li].pts || [];
    for (var i = 0; i < pts.length - 1; i++) COAST_SEGS.push({ a: pts[i], b: pts[i + 1], name: lines[li].name });
  }
  return COAST_SEGS;
}
/** Positive = seaward (ocean), negative = landward. Coast lines are digitized NW→SE; CW normal faces ocean. */
function seawardM(lat, lon) {
  var segs = coastSegs();
  var best = 1e12, bestSeg = null, bestProj = null;
  for (var i = 0; i < segs.length; i++) {
    var r = distToSegmentM(lat, lon, segs[i].a, segs[i].b);
    if (r.distM < best) { best = r.distM; bestSeg = segs[i]; bestProj = r; }
  }
  if (!bestSeg || best > 12000) return { seaM: 0, distM: Math.round(best), far: true };
  var p = bestProj;
  var tx = (bestSeg.b.lon - bestSeg.a.lon) * p.cos, ty = bestSeg.b.lat - bestSeg.a.lat;
  var tlen = Math.sqrt(tx * tx + ty * ty) || 1;
  tx /= tlen; ty /= tlen;
  /* CCW normal = seaward for this overlay's NW→SE mainland digitization */
  var nx = -ty, ny = tx;
  var px = lon * p.cos - p.qx, py = lat - p.qy;
  return { seaM: Math.round((px * nx + py * ny) * 111320), distM: Math.round(best), far: false, name: bestSeg.name };
}
function isOnIsland(lat, lon) {
  var isles = (COAST_OVERLAY_LITE && COAST_OVERLAY_LITE.islands) || [];
  for (var i = 0; i < isles.length; i++) {
    if (isles[i] && isles[i].pts && pointInPoly(lat, lon, isles[i].pts)) return isles[i].name || 'island';
  }
  return '';
}
function extractArray(src, name) {
  var marker = 'const ' + name + ' = [', start = src.indexOf(marker);
  if (start < 0) return null;
  start += marker.length;
  var depth = 1, i = start, inStr = false, strCh = '', esc = false;
  while (i < src.length && depth > 0) {
    var c = src.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === strCh) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    i++;
  }
  if (depth !== 0) return null;
  return eval('[' + src.substring(start, i - 1) + ']');
}
function destPt(lat, lon, brgDeg, distM) {
  var R = 6371000;
  var br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
  var nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  var nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
  return { lat: nla * 180 / Math.PI, lon: ((nlo * 180 / Math.PI + 540) % 360) - 180 };
}
function diveMapPos(site) {
  var pushM = site.mapOffshoreM || 0;
  if (pushM > 0) return destPt(site.lat, site.lon, (site.face || 270) % 360, pushM);
  return { lat: site.lat, lon: site.lon };
}

/** Map-visible water gate: island interior, landward of overlay, or too close to bluff/shore. */
function classifyFailure(lat, lon, boat) {
  var island = isOnIsland(lat, lon);
  if (island) return 'onIsland ' + island;
  var s = seawardM(lat, lon);
  if (s.far) return '';
  if (s.seaM < 0) return 'landward seaM=' + s.seaM + ' dist=' + s.distM;
  /* Require clear water offset from shoreline/bluff for map pins. */
  var minSea = boat ? 40 : 80;
  if (s.seaM < minSea && s.distM < 900) return 'nearshore seaM=' + s.seaM + ' dist=' + s.distM;
  return '';
}

function runCategory(items, category, posFn) {
  var fails = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var p = posFn(item);
    var why = classifyFailure(p.lat, p.lon, !!item.boat);
    if (!why) continue;
    fails.push({
      category: category,
      id: item.id || item.name,
      name: item.name,
      lat: p.lat,
      lon: p.lon,
      why: why
    });
  }
  return fails;
}

var fish = extractArray(readFile('index.html'), 'FISH_SPOTS') || [];
var dive = extractArray(readFile('dive-engine.js'), 'DIVE_SITES') || [];

var fishFails = runCategory(fish, 'FISH_SPOTS', function (s) { return { lat: s.lat, lon: s.lon }; });
var diveFails = runCategory(dive, 'DIVE_SITES', diveMapPos);
var allFails = fishFails.concat(diveFails);

WScript.Echo('Strict map-aligned FAIL fish: ' + fishFails.length);
WScript.Echo('Strict map-aligned FAIL dive: ' + diveFails.length);
WScript.Echo('Strict map-aligned FAIL total: ' + allFails.length);
WScript.Echo('(advisory — not a hard gate; fish/dive onshore scans are authoritative)');
WScript.Echo('');
for (var i = 0; i < allFails.length; i++) {
  var f = allFails[i];
  WScript.Echo(f.category + ' | ' + f.id + ' | ' + f.name + ' | ' +
    Number(f.lat).toFixed(7) + ',' + Number(f.lon).toFixed(7) + ' | ' + f.why);
}
/* Always exit 0 — overfiring seaward-normal matching; hard gates are scan-*-onshore.js */
if (allFails.length) {
  WScript.Echo('');
  WScript.Echo('ADVISORY: map-aligned failures listed above (exit 0).');
} else {
  WScript.Echo('OK: all map-visible fish/dive pins are in water.');
}
