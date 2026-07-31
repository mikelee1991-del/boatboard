// Fix KML-imported FISH_SPOTS coords from audit — cscript //Nologo fix-kml-fish-coords.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function addBoatRegionalFlags(text, name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?)(regional:\\s*true)");
  if (re.test(text)) {
    re.lastIndex = 0;
    if (new RegExp("name:\\s*'" + esc + "'[^\\}]*?boat:\\s*true").test(text)) return { text: text, changed: false };
    return { text: text.replace(re, '$1$2, boat: true'), changed: true };
  }
  re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lon:\\s*-?[\\d.eE+-]+)(\\s*,\\s*face:\\s*\\d+)");
  if (re.test(text)) {
    re.lastIndex = 0;
    return { text: text.replace(re, '$1$2, regional: true, boat: true'), changed: true };
  }
  re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lon:\\s*-?[\\d.eE+-]+)(\\s*,\\s*\\n\\s*species:)");
  if (re.test(text)) {
    re.lastIndex = 0;
    return { text: text.replace(re, '$1, regional: true, boat: true$2'), changed: true };
  }
  return { text: text, changed: false };
}

var audit = eval('(' + readFile('audit-all-locations.json') + ')');
var html = readFile('index.html');
var coordFixes = 0, boatFlags = 0, log = [];

for (var i = 0; i < audit.rows.length; i++) {
  var r = audit.rows[i];
  if (r.category !== 'FISH_SPOTS' || r.verdict !== 'FIX') continue;
  var name = r.name;
  var newLat = null, newLon = null, method = '';

  if (r.sugLat != null) {
    newLat = r.sugLat; newLon = r.sugLon; method = 'audit_sug';
  } else {
    var sug = LA.suggestOffshore(r.lat, r.lon, 270);
    if (sug) { newLat = sug.lat; newLon = sug.lon; method = 'push_' + sug.pushM + 'm'; }
  }

  if (newLat != null) {
    var rr = replaceFishByName(html, name, newLat, newLon);
    if (rr.changed) {
      html = rr.text; coordFixes++;
      log.push('COORD ' + name + ': ' + r.lat + ',' + r.lon + ' -> ' + newLat + ',' + newLon + ' (' + method + ')');
      continue;
    }
  }

  // Far offshore / Mexico / beyond coast model — exempt via boat+regional
  var br = addBoatRegionalFlags(html, name);
  if (br.changed) {
    html = br.text; boatFlags++;
    log.push('BOAT ' + name + ': exempt (' + r.why + ')');
  } else {
    log.push('UNFIXED ' + name + ': ' + r.why);
  }
}

writeFile('index.html', html);
WScript.Echo('Coord fixes: ' + coordFixes + ', boat flags: ' + boatFlags);
WScript.Echo(log.join('\n'));
