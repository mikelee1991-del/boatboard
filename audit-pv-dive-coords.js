// PV dive coord diagnostic — cscript //Nologo audit-pv-dive-coords.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;
var m = readFile('dive-engine.js').match(/const DIVE_SITES = \[([\s\S]*?)\n  \];/);
var sites = eval('[' + m[1] + ']');
var bad = [];
for (var i = 0; i < sites.length; i++) {
  var s = sites[i];
  if (s.lat < 33.68 || s.lat > 33.84 || s.lon < -118.44 || s.lon > -118.26) continue;
  var loc = LA.localEastM(s.lat, s.lon);
  var me = Math.round(LA.metersEastOfShoreline(s.lat, s.lon));
  var shoreLon = null;
  var cands = [];
  for (var li = 0; li < (COAST_GEO.lines || []).length; li++) {
    var line = COAST_GEO.lines[li];
    var pts = line.pts || line;
    if (!pts) continue;
    for (var j = 0; j < pts.length - 1; j++) {
      var a = pts[j], b = pts[j + 1];
      var lo = Math.min(a.lat, b.lat), hi = Math.max(a.lat, b.lat);
      if (s.lat < lo || s.lat > hi) continue;
      var t = Math.abs(b.lat - a.lat) < 1e-9 ? 0.5 : (s.lat - a.lat) / (b.lat - a.lat);
      cands.push(a.lon + t * (b.lon - a.lon));
    }
  }
  if (cands.length) shoreLon = Math.max.apply(null, cands);
  var inlandLon = s.lon > -118.38;
  var fail = loc.eastM > -350 || me > -200 || inlandLon;
  if (fail) bad.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, eastM: loc.eastM, distM: loc.distM, mEast: me, shoreLon: shoreLon, onLand: LA.isOnLand(s.lat, s.lon) });
}
WScript.Echo('PV suspect count: ' + bad.length);
for (var k = 0; k < bad.length; k++) {
  var x = bad[k];
  WScript.Echo(x.id + ' | ' + x.lon + ' | localEast=' + x.eastM + ' mEast=' + x.mEast + ' onLand=' + x.onLand + ' shoreLon=' + x.shoreLon);
}
