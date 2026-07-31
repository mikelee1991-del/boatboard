// Find good vs bad malibu segments near south junction
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var COAST_GEO = {};
eval(fso.OpenTextFile(root + '\\coast-geo.js', 1).ReadAll().replace(/window\.COAST_GEO/g, 'COAST_GEO'));
var pts = COAST_GEO.lines[0].pts;

function isMalibuPhantom(p) {
  if (p.lat >= 33.93 && p.lat <= 34.10 && p.lon > -119.0 && p.lon <= -118.52) {
    var beachLon = -118.44 - (p.lat - 33.94) * (0.41 / 0.16);
    if (p.lon < beachLon - 0.02) return true;
  }
  return false;
}

WScript.Echo('last 30 malibu pts:');
var i, n = pts.length;
for (i = Math.max(0, n - 30); i < n; i++) {
  WScript.Echo('i' + i + ' ' + pts[i].lat.toFixed(5) + ',' + pts[i].lon.toFixed(5) + ' ph=' + isMalibuPhantom(pts[i]));
}
WScript.Echo('');
WScript.Echo('around i8420-8440:');
for (i = 8420; i <= 8440 && i < n; i++) {
  WScript.Echo('i' + i + ' ' + pts[i].lat.toFixed(5) + ',' + pts[i].lon.toFixed(5) + ' ph=' + isMalibuPhantom(pts[i]));
}
