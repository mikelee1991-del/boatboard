// DISABLED 2026-07-27 — DO NOT RUN for production coords.
// Policy: never auto-push pins to silence overlay audits. Source-replace or hide.
// See verified-water-pins.json and .cursor/rules/water-pin-coords.mdc
WScript.Echo('REFUSED: fix-map-water-pins.js is disabled (no coordinate nudges).');
WScript.Quit(1);
/* legacy body below (unreachable)
// Auto-fix fish/dive pins that fail overlay-aligned seaward water gate.
// Run: cscript //Nologo fix-map-water-pins.js
*/
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

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
  return { distM: Math.sqrt(dlat * dlat + dlon * dlon) * 111320, qx: qx, qy: qy, cos: cos };
}
var COAST_SEGS = null;
function coastSegs() {
  if (COAST_SEGS) return COAST_SEGS;
  COAST_SEGS = [];
  var lines = (COAST_OVERLAY_LITE && COAST_OVERLAY_LITE.lines) || [];
  for (var li = 0; li < lines.length; li++) {
    var pts = lines[li].pts || [];
    for (var i = 0; i < pts.length - 1; i++) COAST_SEGS.push({ a: pts[i], b: pts[i + 1] });
  }
  return COAST_SEGS;
}
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
  var nx = -ty, ny = tx;
  var px = lon * p.cos - p.qx, py = lat - p.qy;
  return { seaM: Math.round((px * nx + py * ny) * 111320), distM: Math.round(best), far: false };
}
function isOnIsland(lat, lon) {
  var isles = (COAST_OVERLAY_LITE && COAST_OVERLAY_LITE.islands) || [];
  for (var i = 0; i < isles.length; i++) {
    if (isles[i] && isles[i].pts && pointInPoly(lat, lon, isles[i].pts)) return isles[i].name || 'island';
  }
  return '';
}
function destPt(lat, lon, brgDeg, distM) {
  var R = 6371000;
  var br = brgDeg * D2R, la = lat * D2R, lo = lon * D2R, d = distM / R;
  var nla = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  var nlo = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(nla));
  return { lat: nla * 180 / Math.PI, lon: ((nlo * 180 / Math.PI + 540) % 360) - 180 };
}
function fmt7(n) { return Math.round(n * 1e7) / 1e7; }
function classifyFailure(lat, lon, boat) {
  var island = isOnIsland(lat, lon);
  if (island) return 'onIsland ' + island;
  var s = seawardM(lat, lon);
  if (s.far) return '';
  if (s.seaM < 0) return 'landward';
  var minSea = boat ? 40 : 80;
  if (s.seaM < minSea && s.distM < 900) return 'nearshore';
  return '';
}
function suggestFix(lat, lon, face, boat) {
  var dirs = [face || 270, 270, 250, 240, 225, 210, 200, 180, 160, 300, 315, 330];
  var dists = [40, 80, 120, 160, 200, 260, 320, 400, 500, 650, 800, 1000, 1300, 1600, 2000, 2500, 3200, 4000];
  var seen = {}, uniq = [];
  for (var i = 0; i < dirs.length; i++) {
    if (dirs[i] == null || seen[dirs[i]]) continue;
    seen[dirs[i]] = 1; uniq.push(dirs[i]);
  }
  for (var ui = 0; ui < uniq.length; ui++) {
    for (var di = 0; di < dists.length; di++) {
      var p = destPt(lat, lon, uniq[ui], dists[di]);
      if (classifyFailure(p.lat, p.lon, boat)) continue;
      return { lat: fmt7(p.lat), lon: fmt7(p.lon), pushM: dists[di], dir: uniq[ui] };
    }
  }
  return null;
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
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function replaceFish(src, name, oldLat, oldLon, newLat, newLon) {
  var re = new RegExp(
    '(name:\\s*[\'"]' + escapeRe(name) + '[\'"][\\s\\S]{0,220}?lat:\\s*)' +
      escapeRe(String(oldLat)) + '(\\s*,\\s*lon:\\s*)' + escapeRe(String(oldLon)),
    'm'
  );
  if (!re.test(src)) return { src: src, ok: false };
  return { src: src.replace(re, '$1' + newLat.toFixed(7) + '$2' + newLon.toFixed(7)), ok: true };
}
function replaceDive(src, id, oldLat, oldLon, newLat, newLon) {
  var re = new RegExp(
    '(id:\\s*[\'"]' + escapeRe(id) + '[\'"][\\s\\S]{0,160}?lat:\\s*)' +
      escapeRe(String(oldLat)) + '(\\s*,\\s*lon:\\s*)' + escapeRe(String(oldLon)),
    'm'
  );
  if (!re.test(src)) return { src: src, ok: false };
  return { src: src.replace(re, '$1' + newLat.toFixed(7) + '$2' + newLon.toFixed(7)), ok: true };
}

var dash = readFile('index.html');
var diveSrc = readFile('dive-engine.js');
var fish = extractArray(dash, 'FISH_SPOTS') || [];
var dive = extractArray(diveSrc, 'DIVE_SITES') || [];
var fishFixed = 0, diveFixed = 0, fishMiss = 0, diveMiss = 0;

for (var fi = 0; fi < fish.length; fi++) {
  var s = fish[fi];
  if (!classifyFailure(s.lat, s.lon, !!s.boat)) continue;
  var sug = suggestFix(s.lat, s.lon, s.face || 270, !!s.boat);
  if (!sug) { fishMiss++; WScript.Echo('FISH NOFIX ' + s.name); continue; }
  var r = replaceFish(dash, s.name, s.lat, s.lon, sug.lat, sug.lon);
  if (!r.ok) { fishMiss++; WScript.Echo('FISH REPLACEFAIL ' + s.name + ' ' + s.lat + ',' + s.lon); continue; }
  dash = r.src;
  fishFixed++;
  WScript.Echo('FISH FIX ' + s.name + ' -> ' + sug.lat + ',' + sug.lon + ' (+' + sug.pushM + 'm @' + sug.dir + ')');
}
for (var di = 0; di < dive.length; di++) {
  var d = dive[di];
  var lat = d.lat, lon = d.lon;
  if (d.mapOffshoreM) {
    var mp = destPt(d.lat, d.lon, (d.face || 270) % 360, d.mapOffshoreM);
    lat = mp.lat; lon = mp.lon;
  }
  if (!classifyFailure(lat, lon, !!d.boat)) continue;
  var sug2 = suggestFix(d.lat, d.lon, d.face || 270, !!d.boat);
  if (!sug2) { diveMiss++; WScript.Echo('DIVE NOFIX ' + d.id); continue; }
  var r2 = replaceDive(diveSrc, d.id, d.lat, d.lon, sug2.lat, sug2.lon);
  if (!r2.ok) { diveMiss++; WScript.Echo('DIVE REPLACEFAIL ' + d.id); continue; }
  diveSrc = r2.src;
  diveFixed++;
  WScript.Echo('DIVE FIX ' + d.id + ' -> ' + sug2.lat + ',' + sug2.lon + ' (+' + sug2.pushM + 'm @' + sug2.dir + ')');
}
writeFile('index.html', dash);
writeFile('dive-engine.js', diveSrc);
WScript.Echo('');
WScript.Echo('Fish fixed: ' + fishFixed + ' miss: ' + fishMiss);
WScript.Echo('Dive fixed: ' + diveFixed + ' miss: ' + diveMiss);
if (fishMiss || diveMiss) WScript.Quit(1);
