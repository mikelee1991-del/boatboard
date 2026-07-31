// Extract OSM coastline ways in OC mainland box from coast-osm.json.
// Run: cscript //Nologo extract-oc-coast.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var raw = fso.OpenTextFile(root + '\\coast-osm.json', 1).ReadAll();
var data = JSON.parse(raw);

var nodes = {};
var i, el, j;
for (i = 0; i < data.elements.length; i++) {
  el = data.elements[i];
  if (el.type === 'node') nodes[el.id] = { lat: el.lat, lon: el.lon };
}

var ways = [];
for (i = 0; i < data.elements.length; i++) {
  el = data.elements[i];
  if (el.type !== 'way' || !el.nodes) continue;
  var pts = [];
  for (j = 0; j < el.nodes.length; j++) {
    var n = nodes[el.nodes[j]];
    if (n) pts.push({ lat: n.lat, lon: n.lon });
  }
  if (pts.length >= 2) ways.push({ id: el.id, pts: pts });
}

WScript.Echo('Total ways: ' + ways.length);

function inOC(p) {
  return p.lat >= 33.52 && p.lat <= 33.78 && p.lon >= -118.15 && p.lon <= -117.85;
}

WScript.Echo('=== Ways with pts in OC mainland box ===');
var ocWays = [];
for (i = 0; i < ways.length; i++) {
  var cnt = 0;
  for (j = 0; j < ways[i].pts.length; j++) {
    if (inOC(ways[i].pts[j])) cnt++;
  }
  if (cnt >= 5) {
    ocWays.push({ id: ways[i].id, pts: ways[i].pts, cnt: cnt });
    var p0 = ways[i].pts[0], pL = ways[i].pts[ways[i].pts.length - 1];
    WScript.Echo('way ' + ways[i].id + ': ' + ways[i].pts.length + ' pts, ocCnt=' + cnt +
      ' start ' + p0.lat.toFixed(5) + ',' + p0.lon.toFixed(5) +
      ' end ' + pL.lat.toFixed(5) + ',' + pL.lon.toFixed(5));
  }
}
WScript.Echo('OC ways: ' + ocWays.length);
