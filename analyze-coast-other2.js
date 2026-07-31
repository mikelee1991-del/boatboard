// Trace coast-other-2 path vs distance from slip — find stray geometry.
// Run: cscript //Nologo analyze-coast-other2.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var SLIP_LAT = 33 + 50 / 60 + 53.4 / 3600;
var SLIP_LON = -(118 + 23 / 60 + 46.8 / 3600);
var NM = 1852;

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

var line = null;
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  if (COAST_GEO.lines[li].name === 'coast-other-2') line = COAST_GEO.lines[li];
}
if (!line) { WScript.Echo('no coast-other-2'); WScript.Quit(1); }

var pts = line.pts;
WScript.Echo('coast-other-2: ' + pts.length + ' pts');

WScript.Echo('');
WScript.Echo('=== Sample every ~500th point with dist from slip ===');
for (var i = 0; i < pts.length; i += 500) {
  var p = pts[i];
  WScript.Echo('i' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM: ' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5));
}

WScript.Echo('');
WScript.Echo('=== Segments with large bearing change (>90 deg) near 10-20 NM ===');
function segBrg(a, b) {
  var d2r = Math.PI / 180;
  var la1 = a.lat * d2r, la2 = b.lat * d2r, dlo = (b.lon - a.lon) * d2r;
  var y = Math.sin(dlo) * Math.cos(la2);
  var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dlo);
  return ((Math.atan2(y, x) / d2r) + 360) % 360;
}
function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

var hits = [];
for (i = 2; i < pts.length; i++) {
  var b1 = segBrg(pts[i - 2], pts[i - 1]);
  var b2 = segBrg(pts[i - 1], pts[i]);
  var turn = angDiff(b1, b2);
  var mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lon: (pts[i - 1].lon + pts[i].lon) / 2 };
  var dn = distNm(mid.lat, mid.lon);
  if (turn > 90 && dn >= 10 && dn <= 22) {
    hits.push({ i: i, turn: turn, dn: dn, p: pts[i - 1], b1: b1, b2: b2, segM: haversineM(pts[i - 1], pts[i]) });
  }
}
hits.sort(function (a, b) { return b.turn - a.turn; });
for (i = 0; i < Math.min(15, hits.length); i++) {
  h = hits[i];
  WScript.Echo('i' + h.i + ' turn=' + h.turn.toFixed(0) + 'deg @' + h.dn.toFixed(1) + 'NM seg=' + h.segM.toFixed(0) + 'm brg ' + h.b1.toFixed(0) + '->' + h.b2.toFixed(0) + ' ' + h.p.lat + ',' + h.p.lon);
}

WScript.Echo('');
WScript.Echo('=== Points west of -118.32 at lat 33.68-33.78 (possible channel stray) ===');
var west = 0;
for (i = 0; i < pts.length; i++) {
  p = pts[i];
  if (p.lat >= 33.68 && p.lat <= 33.78 && p.lon < -118.32) {
    west++;
    if (west <= 10) WScript.Echo('i' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM: ' + p.lat + ',' + p.lon);
  }
}
WScript.Echo('Total west-stray pts: ' + west);

WScript.Echo('');
WScript.Echo('=== Max segment in coast-other-2 ===');
var maxD = 0, maxI = -1;
for (i = 0; i < pts.length - 1; i++) {
  d = haversineM(pts[i], pts[i + 1]);
  if (d > maxD) { maxD = d; maxI = i; }
}
WScript.Echo('max ' + maxD.toFixed(1) + 'm (' + (maxD / NM).toFixed(2) + ' NM) at i' + maxI);
WScript.Echo('  ' + pts[maxI].lat + ',' + pts[maxI].lon + ' -> ' + pts[maxI + 1].lat + ',' + pts[maxI + 1].lon);
WScript.Echo('  mid dist ' + distNm((pts[maxI].lat + pts[maxI + 1].lat) / 2, (pts[maxI].lon + pts[maxI + 1].lon) / 2).toFixed(1) + ' NM');
