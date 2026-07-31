// Inspect OSM way endpoints for Malibu chain
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var raw = eval('(' + fso.OpenTextFile(root + '\\coast-osm.json', 1).ReadAll() + ')');
var ids = [41645422, 443088222, 614584879, 1081304239, 1082435167, 4883641, 4883746, 413548141];
var i, j, el;
for (i = 0; i < ids.length; i++) {
  for (j = 0; j < raw.elements.length; j++) {
    el = raw.elements[j];
    if (el.type === 'way' && el.id === ids[i] && el.geometry) {
      var g = el.geometry;
      WScript.Echo('way ' + ids[i] + ' n=' + g.length + ' ' +
        g[0].lat.toFixed(5) + ',' + g[0].lon.toFixed(5) + ' -> ' +
        g[g.length - 1].lat.toFixed(5) + ',' + g[g.length - 1].lon.toFixed(5));
      break;
    }
  }
}
