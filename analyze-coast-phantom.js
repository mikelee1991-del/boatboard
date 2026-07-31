// Find where coast-other-2 leaves true shoreline (channel phantom begins).
// Run: cscript //Nologo analyze-coast-phantom.js
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

var REFS = [
  { name: 'Seal Beach pier', lat: 33.741, lon: -118.104 },
  { name: 'Huntington Pier', lat: 33.655, lon: -118.004 },
  { name: 'Newport Pier', lat: 33.606, lon: -117.933 },
  { name: 'Long Beach Alamitos', lat: 33.756, lon: -118.117 },
  { name: 'San Pedro breakwater', lat: 33.705, lon: -118.275 }
];

var pts = null;
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  if (COAST_GEO.lines[li].name === 'coast-other-2') pts = COAST_GEO.lines[li].pts;
}

function nearestLandmarkM(p) {
  var best = 1e12, name = '';
  for (var r = 0; r < REFS.length; r++) {
    var d = haversineM(p, REFS[r]);
    if (d < best) { best = d; name = REFS[r].name; }
  }
  return { m: best, name: name };
}

WScript.Echo('=== coast-other-2: nearest landmark every 100 pts (i7000-i9000) ===');
for (var i = 7000; i <= 9000; i += 100) {
  var p = pts[i];
  var nl = nearestLandmarkM(p);
  WScript.Echo('i' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM ' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) +
    ' off ' + nl.name + ' ' + (nl.m / NM).toFixed(2) + 'NM');
}

WScript.Echo('');
WScript.Echo('=== Last index within 1.5 NM of any landmark ===');
var lastGood = -1;
for (i = 0; i < pts.length; i++) {
  nl = nearestLandmarkM(pts[i]);
  if (nl.m <= 1.5 * NM) lastGood = i;
}
WScript.Echo('lastGood i=' + lastGood + ' @' + distNm(pts[lastGood].lat, pts[lastGood].lon).toFixed(1) + 'NM ' +
  pts[lastGood].lat + ',' + pts[lastGood].lon);
WScript.Echo('next i=' + (lastGood + 1) + ' ' + pts[lastGood + 1].lat + ',' + pts[lastGood + 1].lon);

WScript.Echo('');
WScript.Echo('=== Mainland coast heuristic: lon should be > -118.20 for lat 33.68-33.76 ===');
var firstBad = -1;
for (i = 0; i < pts.length; i++) {
  p = pts[i];
  if (p.lat >= 33.68 && p.lat <= 33.76 && p.lon < -118.20) {
    firstBad = i;
    WScript.Echo('firstBad i=' + i + ' @' + distNm(p.lat, p.lon).toFixed(1) + 'NM ' + p.lat + ',' + p.lon);
    break;
  }
}

WScript.Echo('');
WScript.Echo('=== Check all lines for OC coast coverage (lat 33.55-33.75, lon > -118.05) ===');
for (li = 0; li < COAST_GEO.lines.length; li++) {
  var line = COAST_GEO.lines[li];
  var cnt = 0;
  for (i = 0; i < line.pts.length; i++) {
    p = line.pts[i];
    if (p.lat >= 33.55 && p.lat <= 33.75 && p.lon > -118.05) cnt++;
  }
  WScript.Echo(line.name + ': ' + cnt + ' pts in OC mainland box');
}
