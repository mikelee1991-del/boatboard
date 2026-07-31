var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var lat = 33.7746738, lon = -118.425, face = 250;
var loc0 = LA.localEastM(lat, lon);
WScript.Echo('seed localEast=' + loc0.eastM + ' dist=' + loc0.distM);
var n = LA.nudgeOffshore(lat, lon, face);
WScript.Echo('nudge: ' + (n ? n.lat + ',' + n.lon + ' ' + n.pushM + 'm @' + n.dir : 'null'));
var s = LA.suggestOffshore(lat, lon, face);
WScript.Echo('sug: ' + (s ? s.lat + ',' + s.lon : 'null'));

for (var d = 80; d <= 400; d += 40) {
  var p = LA.destPt(lat, lon, face, d);
  var loc = LA.localEastM(p.lat, p.lon);
  WScript.Echo(d + 'm @' + face + ': ' + p.lat + ',' + p.lon + ' east=' + loc.eastM + ' onLand=' + LA.isOnLand(p.lat, p.lon));
}
