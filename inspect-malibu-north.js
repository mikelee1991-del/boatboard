// Ways lat 34.03-34.10 lon -118.90 to -118.55
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var raw = eval('(' + fso.OpenTextFile(root + '\\coast-osm.json', 1).ReadAll() + ')');
var j, el, g;
for (j = 0; j < raw.elements.length; j++) {
  el = raw.elements[j];
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 5) continue;
  var b = el.bounds;
  if (!b || b.maxlat < 34.02 || b.minlat > 34.10) continue;
  if (b.maxlon < -118.95 || b.minlon > -118.55) continue;
  g = el.geometry;
  WScript.Echo('way ' + el.id + ' n=' + g.length + ' ' +
    g[0].lat.toFixed(5) + ',' + g[0].lon.toFixed(5) + ' -> ' +
    g[g.length - 1].lat.toFixed(5) + ',' + g[g.length - 1].lon.toFixed(5));
}
