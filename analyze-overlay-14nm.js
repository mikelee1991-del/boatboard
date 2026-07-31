// Analyze coast overlay accuracy vs full geo in 12-20 NM band from slip.
// Run: cscript //Nologo analyze-overlay-14nm.js
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

WScript.Echo('=== Long segments in LITE overlay (>200m) with midpoint dist from slip ===');
var badLite = [];
function scanLite(arr, name) {
  for (var i = 1; i < arr.length; i++) {
    var a = arr[i - 1], b = arr[i];
    var d = haversineM(a, b);
    if (d > 200) {
      var mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      badLite.push({ name: name, d: d, dNm: distNm(mid.lat, mid.lon), a: a, b: b, mid: mid });
    }
  }
}
for (var li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) {
  var ln = COAST_OVERLAY_LITE.lines[li];
  scanLite(ln.pts, ln.name);
}
for (var ii = 0; ii < (COAST_OVERLAY_LITE.islands || []).length; ii++) {
  var is = COAST_OVERLAY_LITE.islands[ii];
  scanLite(is.pts, is.name);
}
badLite.sort(function (x, y) { return y.d - x.d; });
for (var bi = 0; bi < Math.min(20, badLite.length); bi++) {
  var s = badLite[bi];
  WScript.Echo(s.name + ': ' + (s.d / NM).toFixed(2) + ' NM seg, mid@' + s.dNm.toFixed(1) + ' NM from slip ' +
    s.a.lat + ',' + s.a.lon + ' -> ' + s.b.lat + ',' + s.b.lon);
}
WScript.Echo('Total lite segments >200m: ' + badLite.length);

WScript.Echo('');
WScript.Echo('=== Long segments in FULL geo source (>500m) in 12-20 NM band ===');
var badGeo = [];
for (li = 0; li < (COAST_GEO.lines || []).length; li++) {
  var line = COAST_GEO.lines[li];
  var pts = line.pts || line;
  for (var i = 1; i < pts.length; i++) {
    var d = haversineM(pts[i - 1], pts[i]);
    if (d <= 500) continue;
    var mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lon: (pts[i - 1].lon + pts[i].lon) / 2 };
    var dn = distNm(mid.lat, mid.lon);
    if (dn >= 12 && dn <= 20) {
      badGeo.push({ name: line.name, d: d, dNm: dn, i: i, a: pts[i - 1], b: pts[i] });
    }
  }
}
badGeo.sort(function (x, y) { return y.d - x.d; });
for (bi = 0; bi < badGeo.length; bi++) {
  s = badGeo[bi];
  WScript.Echo(s.name + ' idx' + s.i + ': ' + (s.d / NM).toFixed(2) + ' NM jump @' + s.dNm.toFixed(1) + ' NM ' +
    s.a.lat + ',' + s.a.lon + ' -> ' + s.b.lat + ',' + s.b.lon);
}
WScript.Echo('Full geo jumps >500m in 12-20 NM band: ' + badGeo.length);

WScript.Echo('');
WScript.Echo('=== Lite line names and point counts ===');
for (li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) {
  ln = COAST_OVERLAY_LITE.lines[li];
  var minD = 999, maxD = 0, sumD = 0;
  for (i = 0; i < ln.pts.length; i++) {
    dn = distNm(ln.pts[i].lat, ln.pts[i].lon);
    if (dn < minD) minD = dn;
    if (dn > maxD) maxD = dn;
    sumD += dn;
  }
  WScript.Echo(ln.name + ': ' + ln.pts.length + ' pts, dist ' + minD.toFixed(1) + '-' + maxD.toFixed(1) + ' NM');
}

WScript.Echo('');
WScript.Echo('=== Chord vs path: subdivideMax artifacts (sample) ===');
// Check if any lite segment midpoint is far from nearest full-geo coast
function nearestGeoDistM(lat, lon) {
  var best = 1e12;
  for (li = 0; li < (COAST_GEO.lines || []).length; li++) {
    pts = COAST_GEO.lines[li].pts || [];
    for (i = 0; i < pts.length; i++) {
      var dd = haversineM({ lat: lat, lon: lon }, pts[i]);
      if (dd < best) best = dd;
    }
  }
  return best;
}
var offShore = [];
for (li = 0; li < (COAST_OVERLAY_LITE.lines || []).length; li++) {
  ln = COAST_OVERLAY_LITE.lines[li];
  for (i = 1; i < ln.pts.length; i++) {
    mid = { lat: (ln.pts[i - 1].lat + ln.pts[i].lat) / 2, lon: (ln.pts[i - 1].lon + ln.pts[i].lon) / 2 };
    dn = distNm(mid.lat, mid.lon);
    if (dn < 10 || dn > 22) continue;
    var nd = nearestGeoDistM(mid.lat, mid.lon);
    if (nd > 500) offShore.push({ name: ln.name, dNm: dn, offM: nd, mid: mid, segM: haversineM(ln.pts[i - 1], ln.pts[i]) });
  }
}
offShore.sort(function (x, y) { return y.offM - x.offM; });
for (bi = 0; bi < Math.min(15, offShore.length); bi++) {
  s = offShore[bi];
  WScript.Echo(s.name + ' @' + s.dNm.toFixed(1) + 'NM: mid off full geo by ' + s.offM.toFixed(0) + 'm seg=' + s.segM.toFixed(0) + 'm ' + s.mid.lat + ',' + s.mid.lon);
}
