// List PV dive sites still east of bluff water gate — cscript //Nologo audit-pv-dive-map-check.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
var m = readFile('dive-engine.js').match(/const DIVE_SITES = \[([\s\S]*?)\n  \];/);
var sites = eval('[' + m[1] + ']');
var bad = 0;
for (var i = 0; i < sites.length; i++) {
  var s = sites[i];
  var lat = s.lat, lon = s.lon;
  if (lat >= 33.73 && lat <= 33.80 && lon >= -118.44 && lon <= -118.32 && lon > -118.405) {
    bad++;
    WScript.Echo('INLAND ' + s.id + ' ' + lat + ',' + lon);
  }
  if (lat >= 33.68 && lat <= 33.73 && lon >= -118.44 && lon <= -118.28 && lon > -118.36 && !s.boat) {
    bad++;
    WScript.Echo('SANPEDRO ' + s.id + ' ' + lat + ',' + lon);
  }
}
WScript.Echo('Map gate violations: ' + bad);
