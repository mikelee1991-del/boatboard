// Check north chain from 399506122
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var raw = eval('(' + fso.OpenTextFile(root + '\\coast-osm.json', 1).ReadAll() + ')');
var ids = [399506122, 4883353, 4883720, 763471829];
var i, j, el;
for (i = 0; i < ids.length; i++) {
  for (j = 0; j < raw.elements.length; j++) {
    el = raw.elements[j];
    if (el.type === 'way' && el.id === ids[i] && el.geometry) {
      var g = el.geometry;
      WScript.Echo('way ' + ids[i] + ' ' + g[0].lat.toFixed(5) + ',' + g[0].lon.toFixed(5) + ' -> ' +
        g[g.length - 1].lat.toFixed(5) + ',' + g[g.length - 1].lon.toFixed(5));
      break;
    }
  }
}
