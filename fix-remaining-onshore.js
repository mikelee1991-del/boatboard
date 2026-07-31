// Targeted fix for remaining audit failures — cscript //Nologo fix-remaining-onshore.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var FIX = {
  'Horseshoe Kelp': { lat: 33.7180000, lon: -118.4050000 },
  'Valiant wreck fish grounds': { lat: 33.7746738, lon: -118.4420000 },
  'Resort Point kelp wall — PV': { lat: 33.7645497, lon: -118.4420000 },
  'Marguerite Cove kelp — PV': { lat: 33.7566879, lon: -118.4350000 },
  'Lunada Bay outer reef fish — PV': { lat: 33.7674141, lon: -118.4420000 },
  'Marineland Reef 80ft': { lat: 33.7315000, lon: -118.4250000 },
  'Vicente Outside Rock 80ft': { lat: 33.7345000, lon: -118.4350000 },
  'Sand Bass Junction': { lat: 33.6843000, lon: -118.1550000 },
  'San Onofre': { lat: 33.3480000, lon: -117.5900000 },
  'Golf Ball Reef — Fermin Point kelp': { lat: 33.8082500, lon: -118.4355000 },
  'Manhattan Beach / El Porto halibut flats': { lat: 33.8844444, lon: -118.4450000 },
  'El Porto reef fish — Manhattan': { lat: 33.8850000, lon: -118.4450000 },
  "The Crane — Haggerty's offshore": { lat: 33.8049333, lon: -118.4350000 }
};

var DIVE_FIX = {
  golfball: { lat: 33.8082500, lon: -118.4355000 },
  horseshoe: { lat: 33.7180000, lon: -118.4050000 },
  manhattan: { lat: 33.8844444, lon: -118.4450000 },
  thecrane: { lat: 33.8049333, lon: -118.4350000 },
  elporto: { lat: 33.8850000, lon: -118.4450000 }
};

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function replaceDiveById(text, id, lat, lon) {
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function addBoatRegional(text, name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp("name:\\s*'" + esc + "'[^\\}]*?boat:\\s*true").test(text)) return { text: text, changed: false };
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lon:\\s*-?[\\d.eE+-]+)(\\s*,\\s*face:\\s*\\d+)");
  if (re.test(text)) { re.lastIndex = 0; return { text: text.replace(re, '$1$2, regional: true, boat: true'), changed: true }; }
  re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lon:\\s*-?[\\d.eE+-]+)(\\s*,\\s*\\n\\s*species:)");
  if (re.test(text)) { re.lastIndex = 0; return { text: text.replace(re, '$1, regional: true, boat: true$2'), changed: true }; }
  return { text: text, changed: false };
}

var html = readFile('index.html');
var de = readFile('dive-engine.js');
var fc = 0, dc = 0, log = [];

for (var fn in FIX) {
  if (!FIX.hasOwnProperty(fn)) continue;
  var m = FIX[fn];
  var r = replaceFishByName(html, fn, m.lat, m.lon);
  if (r.changed) {
    html = r.text; fc++;
    var loc = LA.localEastM(m.lat, m.lon);
    log.push('FISH ' + fn + ' -> ' + m.lat + ',' + m.lon + ' (localEast=' + loc.eastM + ')');
  }
}

for (var did in DIVE_FIX) {
  if (!DIVE_FIX.hasOwnProperty(did)) continue;
  var dm = DIVE_FIX[did];
  var dr = replaceDiveById(de, did, dm.lat, dm.lon);
  if (dr.changed) { de = dr.text; dc++; log.push('DIVE ' + did); }
}

var br = addBoatRegional(html, 'Yellowtail Kelp');
if (br.changed) { html = br.text; log.push('BOAT Yellowtail Kelp'); }

writeFile('index.html', html);
writeFile('dive-engine.js', de);
WScript.Echo('Fixed ' + fc + ' fish, ' + dc + ' dive');
WScript.Echo(log.join('\n'));
