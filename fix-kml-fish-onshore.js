// Fix ALL onshore FISH_SPOTS — cscript //Nologo fix-kml-fish-onshore.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function extractArray(src, name) {
  var marker = 'const ' + name + ' = [', start = src.indexOf(marker);
  if (start < 0) return null;
  start += marker.length;
  var depth = 1, i = start, inStr = false, strCh = '', esc = false;
  while (i < src.length && depth > 0) {
    var c = src.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === strCh) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    i++;
  }
  if (depth !== 0) return null;
  return eval('[' + src.substring(start, i - 1) + ']');
}

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function addBoatRegionalFlags(text, name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp("name:\\s*'" + esc + "'[^\\}]*?boat:\\s*true").test(text)) return { text: text, changed: false };
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?)(regional:\\s*true)");
  if (re.test(text)) {
    re.lastIndex = 0;
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

var FISH_SPOTS = extractArray(readFile('index.html'), 'FISH_SPOTS');
var html = readFile('index.html');
var found = 0, coordFixes = 0, boatFlags = 0, unfixed = 0, log = [];

for (var i = 0; i < FISH_SPOTS.length; i++) {
  var s = FISH_SPOTS[i];
  if (s.boat && s.regional) continue;
  var row = LA.auditItem(s, 'FISH_SPOTS');
  if (row.verdict !== 'FIX') continue;
  found++;
  var newLat = null, newLon = null, method = '';
  if (row.sugLat != null) {
    newLat = row.sugLat; newLon = row.sugLon; method = row.sugPush || 'audit_sug';
  } else {
    var sug = LA.suggestOffshore(s.lat, s.lon, s.face || 270);
    if (sug) { newLat = sug.lat; newLon = sug.lon; method = sug.pushM + 'm @' + sug.dir; }
  }
  if (newLat != null) {
    var rr = replaceFishByName(html, s.name, newLat, newLon);
    if (rr.changed) {
      html = rr.text; coordFixes++;
      log.push('COORD ' + s.name + ': ' + s.lat + ',' + s.lon + ' -> ' + newLat + ',' + newLon + ' (' + method + ') [' + row.why + ']');
      continue;
    }
  }
  var br = addBoatRegionalFlags(html, s.name);
  if (br.changed) {
    html = br.text; boatFlags++;
    log.push('BOAT ' + s.name + ': exempt (' + row.why + ')');
  } else {
    unfixed++;
    log.push('UNFIXED ' + s.name + ': ' + row.why);
  }
}

writeFile('index.html', html);
WScript.Echo('Found onshore: ' + found);
WScript.Echo('Coord fixes: ' + coordFixes + ', boat flags: ' + boatFlags + ', unfixed: ' + unfixed);
WScript.Echo(log.join('\n'));
