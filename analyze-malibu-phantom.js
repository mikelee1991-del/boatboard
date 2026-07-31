// Find malibu phantom segment boundaries in coast-geo.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var pts = COAST_GEO.lines[0].pts;

function isMalibuPhantom(p) {
  // SM Bay / Malibu open coast: real beach ~-118.44 at El Segundo to ~-118.80 at Point Dume.
  // Source malibu line runs ~0.5-3 NM WEST (offshore) of beaches lat 33.94-34.06.
  if (p.lat >= 33.93 && p.lat <= 34.10 && p.lon <= -118.52) {
    // Keep accurate far-north Ventura county (lon < -119.0)
    if (p.lon <= -119.0) return false;
    // Expected beach lon ~ linear: at 33.94 lon~-118.44, at 34.10 lon~-118.85
    var beachLon = -118.44 - (p.lat - 33.94) * (0.41 / 0.16);
    if (p.lon < beachLon - 0.025) return true; // >~1 NM west of beach
  }
  return false;
}

var start = -1, end = -1, inP = false, i, phCount = 0;
for (i = 0; i < pts.length; i++) {
  if (isMalibuPhantom(pts[i])) {
    phCount++;
    if (!inP) { start = i; inP = true; }
    end = i;
  }
}
WScript.Echo('malibu total=' + pts.length + ' phantom=' + phCount);
if (start >= 0) {
  WScript.Echo('phantom run: i' + start + '..' + end);
  WScript.Echo('before: ' + pts[start - 1].lat + ',' + pts[start - 1].lon);
  WScript.Echo('phantom0: ' + pts[start].lat + ',' + pts[start].lon);
  WScript.Echo('phantomN: ' + pts[end].lat + ',' + pts[end].lon);
  if (end + 1 < pts.length) WScript.Echo('after: ' + pts[end + 1].lat + ',' + pts[end + 1].lon);
}
