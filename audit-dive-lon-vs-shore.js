// Lon vs shoreline at lat — cscript //Nologo audit-dive-lon-vs-shore.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;
function bestShoreLonAtLat(lat) {
  var out = [];
  for (var li = 0; li < (COAST_GEO.lines || []).length; li++) {
    var line = COAST_GEO.lines[li];
    var pts = line.pts || line;
    if (!pts) continue;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var lo = Math.min(a.lat, b.lat), hi = Math.max(a.lat, b.lat);
      if (lat < lo || lat > hi) continue;
      var t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (lat - a.lat) / (b.lat - a.lat);
      out.push(a.lon + t * (b.lon - a.lon));
    }
  }
  return out.length ? Math.max.apply(null, out) : null;
}
var m = readFile('dive-engine.js').match(/const DIVE_SITES = \[([\s\S]*?)\n  \];/);
var sites = eval('[' + m[1] + ']');
var rows = [];
for (var i = 0; i < sites.length; i++) {
  var s = sites[i];
  if (s.lat < 32.4 || s.lat > 35.2 || s.lon < -121.5 || s.lon > -117) continue;
  if (LA.isFarOffshoreFish(s.lat, s.lon) && s.regional) continue;
  if (LA.onIsland(s.lat, s.lon)) continue;
  var shore = bestShoreLonAtLat(s.lat);
  if (shore == null) continue;
  var delta = (s.lon - shore) * 111320 * Math.cos(s.lat * Math.PI / 180);
  var loc = LA.localEastM(s.lat, s.lon);
  rows.push({ id: s.id, lat: s.lat, lon: s.lon, shore: shore, deltaM: Math.round(delta), eastM: loc.eastM, distM: loc.distM, boat: !!s.boat });
}
rows.sort(function (a, b) { return b.deltaM - a.deltaM; });
WScript.Echo('Sites east of shoreline (deltaM>0) or weakly west (<150m):');
var fail = 0;
for (var j = 0; j < rows.length; j++) {
  var r = rows[j];
  if (r.deltaM > -150) {
    fail++;
    WScript.Echo(r.id + ' | lon=' + r.lon + ' shore=' + r.shore + ' deltaM=' + r.deltaM + ' localEast=' + r.eastM + ' dist=' + r.distM);
  }
}
WScript.Echo('FAIL count (not >=150m west of shore): ' + fail);
