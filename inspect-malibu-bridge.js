// Find OSM ways bridging SM (33.995) to Pacific Palisades (34.025)
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var raw = eval('(' + fso.OpenTextFile(root + '\\coast-osm.json', 1).ReadAll() + ')');

function hav(a, b) {
  var R = 6371000, d2r = Math.PI / 180;
  var dlat = (b.lat - a.lat) * d2r, dlon = (b.lon - a.lon) * d2r;
  var la = a.lat * d2r, lb = b.lat * d2r;
  var h = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

var j, el, g, i;
for (j = 0; j < raw.elements.length; j++) {
  el = raw.elements[j];
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 5) continue;
  g = el.geometry;
  var b = el.bounds;
  if (!b || b.maxlat < 33.98 || b.minlat > 34.04) continue;
  if (b.maxlon < -118.55 || b.minlon > -118.45) continue;
  WScript.Echo('way ' + el.id + ' n=' + g.length + ' ' +
    g[0].lat.toFixed(5) + ',' + g[0].lon.toFixed(5) + ' -> ' +
    g[g.length - 1].lat.toFixed(5) + ',' + g[g.length - 1].lon.toFixed(5));
}

WScript.Echo('');
WScript.Echo('dist 443088222 north to 614584879 south:');
var a = { lat: 33.99529, lon: -118.48402 };
var b = { lat: 34.02490, lon: -118.51762 };
WScript.Echo(hav(a, b).toFixed(0) + 'm');
