// Check if coast-other-2 SE section is west-displaced from known coastal cities.
// Run: cscript //Nologo analyze-coast-offset.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var COAST_OVERLAY_LITE = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'COAST_OVERLAY_LITE'));

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

// Reference coastal landmarks (approx pier/harbor mouths)
var REFS = [
  { name: 'Seal Beach pier', lat: 33.741, lon: -118.104 },
  { name: 'Huntington Pier', lat: 33.655, lon: -118.004 },
  { name: 'Newport Pier', lat: 33.606, lon: -117.933 },
  { name: 'Laguna Main Beach', lat: 33.543, lon: -117.784 },
  { name: 'Dana Point', lat: 33.460, lon: -117.698 },
  { name: 'San Pedro breakwater', lat: 33.705, lon: -118.275 },
  { name: 'Long Beach Alamitos', lat: 33.756, lon: -118.117 }
];

function getLine(name, src) {
  for (var i = 0; i < src.lines.length; i++) {
    if (src.lines[i].name === name) return src.lines[i].pts;
  }
  return null;
}

var full = getLine('coast-other-2', COAST_GEO);
var lite = getLine('coast-other-2', COAST_OVERLAY_LITE);

WScript.Echo('=== coast-other-2 SE section (i8200+) vs landmarks ===');
WScript.Echo('Format: index distFromSlip | FULL geo | offset to nearest landmark');
for (var i = 8200; i <= 10000; i += 400) {
  var p = full[i];
  var best = 1e12, bestName = '';
  for (var r = 0; r < REFS.length; r++) {
    var d = haversineM(p, REFS[r]);
    if (d < best) { best = d; bestName = REFS[r].name; }
  }
  WScript.Echo('i' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM: ' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) +
    ' | nearest ' + bestName + ' ' + (best / NM).toFixed(2) + ' NM (' + best.toFixed(0) + 'm)');
  var lp = lite[Math.min(i, lite.length - 1)];
  if (lp) {
    var off = haversineM(p, lp);
    if (off > 1) WScript.Echo('  LITE MISMATCH: ' + lp.lat + ',' + lp.lon + ' off=' + off.toFixed(1) + 'm');
  }
}

WScript.Echo('');
WScript.Echo('=== San Pedro section i0-i8000 nearest landmark ===');
for (i = 0; i <= 8000; i += 1000) {
  p = full[i];
  best = 1e12; bestName = '';
  for (r = 0; r < REFS.length; r++) {
    d = haversineM(p, REFS[r]);
    if (d < best) { best = d; bestName = REFS[r].name; }
  }
  WScript.Echo('i' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM: ' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) +
    ' | nearest ' + bestName + ' ' + (best / NM).toFixed(2) + ' NM');
}

WScript.Echo('');
WScript.Echo('=== pv-south / south-bay accuracy spot check ===');
var lines = ['pv-south', 'south-bay', 'malibu'];
for (var li = 0; li < lines.length; li++) {
  pts = getLine(lines[li], COAST_GEO);
  if (!pts) continue;
  var mid = pts[Math.floor(pts.length / 2)];
  best = 1e12; bestName = '';
  for (r = 0; r < REFS.length; r++) {
    d = haversineM(mid, REFS[r]);
    if (d < best) { best = d; bestName = REFS[r].name; }
  }
  WScript.Echo(lines[li] + ' mid @' + distNm(mid.lat, mid.lon).toFixed(1) + 'NM: nearest ' + bestName + ' ' + (best / NM).toFixed(2) + ' NM');
}
