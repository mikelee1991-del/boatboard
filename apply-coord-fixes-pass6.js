// Pass 6 — strip bad boat+regional, apply manual + audit offshore fixes
// Run: cscript //Nologo apply-coord-fixes-pass6.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var MANUAL = {
  golfball: { lat: 33.8082500, lon: -118.4355000 },
  horseshoe: { lat: 33.7180000, lon: -118.3920000 },
  manhattan: { lat: 33.8844444, lon: -118.4450000 },
  thecrane: { lat: 33.8049333, lon: -118.4220000 },
  elporto: { lat: 33.8850000, lon: -118.4450000 },
  kingharbor: { lat: 33.8347222, lon: -118.4280000 },
  redondopier: { lat: 33.8361111, lon: -118.4280000 },
  hermosareef: { lat: 33.8536111, lon: -118.4280000 },
  marineland: { lat: 33.7315000, lon: -118.4180000 },
  vicenteoutside: { lat: 33.7345000, lon: -118.4280000 },
  valiant: { lat: 33.7746738, lon: -118.4380000 },
  resortpt: { lat: 33.7645497, lon: -118.4380000 },
  lunadaouter: { lat: 33.7674141, lon: -118.4380000 },
  marguerite: { lat: 33.7566879, lon: -118.4280000 },
  sshilda: { lat: 33.7319167, lon: -118.2100000 },
  hermosahb: { lat: 33.8682000, lon: -118.4380000 },
  manhattanhb: { lat: 33.8800000, lon: -118.4480000 },
  elsundopipe: { lat: 33.9220000, lon: -118.4680000 },
  sandbass: { lat: 33.6843000, lon: -118.1450000 },
  venicepier: { lat: 33.9850000, lon: -118.4880000 },
  redondoreef: { lat: 33.8295942, lon: -118.4280000 }
};

var FISH_MANUAL = {
  'King Harbor mouth & Redondo Canyon lip': 'kingharbor',
  'Horseshoe Kelp': 'horseshoe',
  'Manhattan Beach / El Porto halibut flats': 'manhattan',
  "Golf Ball Reef — Fermin Point kelp": 'golfball',
  "The Crane — Haggerty's offshore": 'thecrane',
  'El Porto reef fish — Manhattan': 'elporto',
  'Redondo pier offshore kelp string': 'redondopier',
  'Hermosa Beach Artificial Reef center': 'hermosareef',
  'Marineland Reef 80ft': 'marineland',
  'Vicente Outside Rock 80ft': 'vicenteoutside',
  'Valiant wreck fish grounds': 'valiant',
  'Resort Point kelp wall — PV': 'resortpt',
  'Lunada Bay outer reef fish — PV': 'lunadaouter',
  'Marguerite Cove kelp — PV': 'marguerite',
  'SS Hilda wreck fish — San Pedro': 'sshilda',
  'Hermosa Hard Bottom': 'hermosahb',
  'Manhattan Hard Bottom': 'manhattanhb',
  'El Segundo Pipe': 'elsundopipe',
  'Sand Bass Junction': 'sandbass',
  'Venice Pier Reef': 'venicepier',
  'Redondo Beach Artificial Reef Center': 'redondoreef'
};

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function stripBoatRegional(text, name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?),\\s*regional:\\s*true,\\s*boat:\\s*true");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1'), changed: true };
}

function extractArray(src, name) {
  var marker = 'const ' + name + ' = [';
  var start = src.indexOf(marker);
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
  return eval('[' + src.substring(start, i - 1) + ']');
}

var html = readFile('index.html');
var log = [], manualC = 0, stripC = 0, autoC = 0;

for (var fn in FISH_MANUAL) {
  if (!FISH_MANUAL.hasOwnProperty(fn)) continue;
  var mm = MANUAL[FISH_MANUAL[fn]];
  if (!mm) continue;
  var hr = replaceFishByName(html, fn, mm.lat, mm.lon);
  if (hr.changed) { html = hr.text; manualC++; log.push('MANUAL ' + fn); }
}

var FISH_SPOTS = extractArray(html, 'FISH_SPOTS');
for (var i = 0; i < FISH_SPOTS.length; i++) {
  var s = FISH_SPOTS[i];
  if (!s.boat || !s.regional) continue;
  if (LA.isFarOffshoreFish(s.lat, s.lon)) continue;
  var issue = LA.needsOffshoreFix(s.lat, s.lon, s.face || 270, true, true, 'FISH_SPOTS');
  if (!issue) continue;
  var sr = stripBoatRegional(html, s.name);
  if (sr.changed) { html = sr.text; stripC++; log.push('STRIP boat+regional ' + s.name + ' (' + issue.why + ')'); }
}

FISH_SPOTS = extractArray(html, 'FISH_SPOTS');
for (var pass = 0; pass < 3; pass++) {
  var changed = 0;
  FISH_SPOTS = extractArray(html, 'FISH_SPOTS');
  for (var j = 0; j < FISH_SPOTS.length; j++) {
    var sp = FISH_SPOTS[j];
    var iss = LA.needsOffshoreFix(sp.lat, sp.lon, sp.face || 270, !!sp.boat, !!sp.regional, 'FISH_SPOTS');
    if (!iss) continue;
    var sug = LA.suggestOffshore(sp.lat, sp.lon, sp.face || 270);
    if (!sug) continue;
    var ar = replaceFishByName(html, sp.name, sug.lat, sug.lon);
    if (ar.changed) { html = ar.text; autoC++; changed++; log.push('AUTO ' + sp.name + ': ' + iss.why + ' -> ' + sug.lat + ',' + sug.lon); }
  }
  if (!changed) break;
}

function addBoatRegionalFlags(text, name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp("name:\\s*'" + esc + "'[^\\}]*?boat:\\s*true").test(text)) return { text: text, changed: false };
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lon:\\s*-?[\\d.eE+-]+)(\\s*,\\s*face:\\s*\\d+)");
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

FISH_SPOTS = extractArray(html, 'FISH_SPOTS');
var boatC = 0;
for (var k = 0; k < FISH_SPOTS.length; k++) {
  var u = FISH_SPOTS[k];
  if (u.boat && u.regional) continue;
  if (!LA.isFarOffshoreFish(u.lat, u.lon)) continue;
  var uiss = LA.needsOffshoreFix(u.lat, u.lon, u.face || 270, false, false, 'FISH_SPOTS');
  if (!uiss) continue;
  var br = addBoatRegionalFlags(html, u.name);
  if (br.changed) { html = br.text; boatC++; log.push('BOAT ' + u.name + ' (' + uiss.why + ')'); }
}

writeFile('index.html', html);
WScript.Echo('Pass6: ' + manualC + ' manual, ' + stripC + ' stripped, ' + autoC + ' auto, ' + boatC + ' boat');
if (log.length) WScript.Echo(log.join('\n'));
