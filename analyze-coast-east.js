// Find OC mainland points vs channel phantom in coast-other-2.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));

var NM = 1852;
function haversineM(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

var pts = null;
for (var li = 0; li < COAST_GEO.lines.length; li++) {
  if (COAST_GEO.lines[li].name === 'coast-other-2') pts = COAST_GEO.lines[li].pts;
}

WScript.Echo('=== Points with lon > -118.05 (east/on mainland side) lat 33.5-33.8 ===');
var eastPts = [];
for (var i = 0; i < pts.length; i++) {
  var p = pts[i];
  if (p.lat >= 33.5 && p.lat <= 33.8 && p.lon > -118.05) eastPts.push({ i: i, p: p });
}
WScript.Echo('count=' + eastPts.length);
for (var j = 0; j < Math.min(10, eastPts.length); j++) {
  WScript.Echo('i' + eastPts[j].i + ': ' + eastPts[j].p.lat + ',' + eastPts[j].p.lon);
}
if (eastPts.length > 10) {
  WScript.Echo('...');
  for (j = eastPts.length - 5; j < eastPts.length; j++) {
    WScript.Echo('i' + eastPts[j].i + ': ' + eastPts[j].p.lat + ',' + eastPts[j].p.lon);
  }
}

WScript.Echo('');
WScript.Echo('=== First index lat<33.62 with lon>-117.98 (San Diego county proper) ===');
for (i = 0; i < pts.length; i++) {
  p = pts[i];
  if (p.lat < 33.62 && p.lon > -117.98) {
    WScript.Echo('i=' + i + ': ' + p.lat + ',' + p.lon);
    break;
  }
}

WScript.Echo('');
WScript.Echo('=== Segment i8050-8150 coords ===');
for (i = 8050; i <= 8150; i += 10) {
  WScript.Echo('i' + i + ': ' + pts[i].lat.toFixed(5) + ',' + pts[i].lon.toFixed(5));
}
