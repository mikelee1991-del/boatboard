// Geographic extent and gap analysis for coast overlay lines.
// Run: cscript //Nologo analyze-overlay-coverage.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }

var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
var NM = 1852;

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var COAST_OVERLAY_LITE = {};
eval(readFile('coast-overlay-lite.js').replace(/window\.COAST_OVERLAY_LITE/g, 'COAST_OVERLAY_LITE'));

function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distNm(lat, lon) {
  return haversineM({ lat: SLIP_LAT, lon: SLIP_LON }, { lat: lat, lon: lon }) / NM;
}
function bearing(lat, lon) {
  var d2r = Math.PI / 180, la1 = SLIP_LAT * d2r, la2 = lat * d2r;
  var dlo = (lon - SLIP_LON) * d2r;
  var y = Math.sin(dlo) * Math.cos(la2);
  var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dlo);
  return ((Math.atan2(y, x) / d2r) + 360) % 360;
}

function analyzeSet(lines, label) {
  WScript.Echo('=== ' + label + ' ===');
  for (var li = 0; li < lines.length; li++) {
    var ln = lines[li];
    var pts = ln.pts || ln;
    if (!pts.length) continue;
    var minD = 999, maxD = 0, minBr = 999, maxBr = -999;
    var latMin = 999, latMax = -999, lonMin = 999, lonMax = -999;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var dn = distNm(p.lat, p.lon);
      var br = bearing(p.lat, p.lon);
      if (dn < minD) minD = dn;
      if (dn > maxD) maxD = dn;
      if (br < minBr) minBr = br;
      if (br > maxBr) maxBr = br;
      if (p.lat < latMin) latMin = p.lat;
      if (p.lat > latMax) latMax = p.lat;
      if (p.lon < lonMin) lonMin = p.lon;
      if (p.lon > lonMax) lonMax = p.lon;
    }
    WScript.Echo(ln.name + ': ' + pts.length + ' pts, dist ' + minD.toFixed(1) + '-' + maxD.toFixed(1) +
      ' NM, brg ' + minBr.toFixed(0) + '-' + maxBr.toFixed(0) +
      ' deg, bbox lat ' + latMin.toFixed(3) + '..' + latMax.toFixed(3) + ' lon ' + lonMin.toFixed(3) + '..' + lonMax.toFixed(3));
    WScript.Echo('  first: ' + pts[0].lat + ',' + pts[0].lon + ' (' + distNm(pts[0].lat, pts[0].lon).toFixed(1) + ' NM)');
    WScript.Echo('  last:  ' + pts[pts.length - 1].lat + ',' + pts[pts.length - 1].lon + ' (' + distNm(pts[pts.length - 1].lat, pts[pts.length - 1].lon).toFixed(1) + ' NM)');
  }
}

analyzeSet(COAST_GEO.lines, 'FULL GEO lines');
WScript.Echo('');
analyzeSet(COAST_OVERLAY_LITE.lines, 'LITE overlay lines');

WScript.Echo('');
WScript.Echo('=== Points in 13-15 NM ring from slip (lite) ===');
var ring = [];
for (li = 0; li < COAST_OVERLAY_LITE.lines.length; li++) {
  ln = COAST_OVERLAY_LITE.lines[li];
  for (i = 0; i < ln.pts.length; i++) {
    dn = distNm(ln.pts[i].lat, ln.pts[i].lon);
    if (dn >= 13 && dn <= 15) {
      ring.push({ name: ln.name, dn: dn, br: bearing(ln.pts[i].lat, ln.pts[i].lon), p: ln.pts[i] });
    }
  }
}
ring.sort(function (a, b) { return a.br - b.br; });
for (i = 0; i < ring.length; i++) {
  r = ring[i];
  if (i === 0 || ring[i - 1].name !== r.name || Math.abs(ring[i - 1].br - r.br) > 5) {
    WScript.Echo(r.name + ' @' + r.dn.toFixed(1) + 'NM brg' + r.br.toFixed(0) + ': ' + r.p.lat + ',' + r.p.lon);
  }
}
WScript.Echo('Total lite pts in 13-15 NM ring: ' + ring.length);

WScript.Echo('');
WScript.Echo('=== Compare: nearest full-geo coast to lite pts in ring (max offset) ===');
var worst = [];
for (i = 0; i < ring.length; i++) {
  var rp = ring[i].p;
  var best = 1e12;
  for (li = 0; li < COAST_GEO.lines.length; li++) {
    pts = COAST_GEO.lines[li].pts;
    for (var j = 0; j < pts.length; j++) {
      dd = haversineM(rp, pts[j]);
      if (dd < best) best = dd;
    }
  }
  if (best > 50) worst.push({ name: ring[i].name, dn: ring[i].dn, br: ring[i].br, offM: best, p: rp });
}
worst.sort(function (a, b) { return b.offM - a.offM; });
for (i = 0; i < Math.min(20, worst.length); i++) {
  w = worst[i];
  WScript.Echo(w.name + ' off=' + w.offM.toFixed(0) + 'm @' + w.dn.toFixed(1) + 'NM brg' + w.br.toFixed(0) + ' ' + w.p.lat + ',' + w.p.lon);
}

WScript.Echo('');
WScript.Echo('=== clipLineSegments simulation: segments dropped near 14NM? ===');
var MAX_NM = 100;
function nearSlip(lat, lon) { return distNm(lat, lon) <= MAX_NM; }
for (li = 0; li < COAST_GEO.lines.length; li++) {
  line = COAST_GEO.lines[li];
  pts = line.pts;
  var inRing = 0, outRing = 0, clipped = 0;
  for (i = 0; i < pts.length; i++) {
    dn = distNm(pts[i].lat, pts[i].lon);
    if (dn >= 13 && dn <= 15) inRing++;
    if (!nearSlip(pts[i].lat, pts[i].lon) && dn >= 12 && dn <= 16) outRing++;
  }
  // count lite pts in ring for this line name
  var liteRing = 0;
  for (var li2 = 0; li2 < COAST_OVERLAY_LITE.lines.length; li2++) {
    if (COAST_OVERLAY_LITE.lines[li2].name.indexOf(line.name) !== 0 && COAST_OVERLAY_LITE.lines[li2].name !== line.name) continue;
    ln = COAST_OVERLAY_LITE.lines[li2];
    for (i = 0; i < ln.pts.length; i++) {
      dn = distNm(ln.pts[i].lat, ln.pts[i].lon);
      if (dn >= 13 && dn <= 15) liteRing++;
    }
  }
  if (inRing > 0 || liteRing > 0) {
    WScript.Echo(line.name + ': full pts in 13-15NM=' + inRing + ', lite pts in ring=' + liteRing);
  }
}
