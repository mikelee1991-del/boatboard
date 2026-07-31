var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;
var rows = [
  { id: 'mdreyreef', lat: 33.9683333, lon: -118.5063889, face: 250 },
  { id: 'smbayreef', lat: 34.0130556, lon: -118.5725, face: 270 },
  { id: 'topanga', lat: 34.0272222, lon: -118.5625, face: 200 },
  { id: 'smfish', lat: 34.0095, lon: -118.5597, face: 250 }
];
for (var i = 0; i < rows.length; i++) {
  var r = rows[i];
  var issue = LA.needsOffshoreFix(r.lat, r.lon, r.face, true, true, 'DIVE_SITES');
  var sug = LA.nudgeOffshore(r.lat, r.lon, r.face) || LA.suggestOffshore(r.lat, r.lon, r.face);
  var loc = LA.localEastM(r.lat, r.lon);
  WScript.Echo(r.id + ' issue=' + (issue ? issue.why : 'OK') + ' loc=' + loc.eastM + '/' + loc.distM +
    ' sug=' + (sug ? (sug.lat + ',' + sug.lon + ' push=' + sug.pushM + ' dir=' + sug.dir) : 'none'));
}
