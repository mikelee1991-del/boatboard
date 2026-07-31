// Authoritative manual offshore coord overrides — cscript //Nologo apply-coord-fixes-offshore.js
// Does NOT auto-push sites (prevents wrong-bearing drift). Use audit-all-locations.js to verify.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

// Hard-coded authoritative targets (6–7 decimals). Sources: USC Sea Grant, CDFG, wreck charts.
var MANUAL = {
  sacred: { lat: 33.7410000, lon: -118.3730000, face: 210, note: 'USC #22 kelp ~200m W offshore' },
  sacredoff: { lat: 33.7390000, lon: -118.3810000, face: 210, note: 'Sacred outer reef W of kelp line' },
  wreck140: { lat: 33.7191667, lon: -118.3183333, face: 200, note: 'PC-140 offshore White Point ~55ft' },
  portuguese: { lat: 33.7359480, lon: -118.3648333, face: 220, note: 'USC #23 pushed seaward' },
  abalone: { lat: 33.7368000, lon: -118.3858333, face: 200, note: 'Abalone Cove kelp offshore W' },
  hermosa: { lat: 33.8541667, lon: -118.4138889, face: 250, note: 'CDFG Hermosa reef A' },
  manhattan: { lat: 33.8844444, lon: -118.4166667, face: 250, note: 'El Porto/Manhattan kelp' },
  venice: { lat: 33.9850000, lon: -118.4880000, face: 270, note: '~350m W of pier' },
  smpier: { lat: 33.9980000, lon: -118.5250000, face: 270, note: '~500m W of pier' },
  playadelrey: { lat: 33.9600000, lon: -118.4625000, face: 250, note: '~200m W of beach' },
  sshilda: { lat: 33.7319167, lon: -118.1958333, face: 270, note: 'Johanna Smith wreck channel' }
};

var FISH_TO_DIVE = {
  'Portuguese Bend / Sacred Cove kelp': 'sacred',
  'Sacred Cove outer reef fish — PV': 'sacredoff',
  'PC-140 wreck fish — San Pedro': 'wreck140',
  'Hermosa Beach / Rat Beach flats': 'hermosa',
  'Manhattan Beach / El Porto halibut flats': 'manhattan',
  'Abalone Cove offshore kelp (PV)': 'abalone',
  'Venice Beach nearshore fish': 'venice',
  'Santa Monica Pier reef fish': 'smpier',
  'Playa del Rey reef fish': 'playadelrey',
  'SS Hilda wreck fish — San Pedro': 'sshilda'
};

function replaceDiveById(text, id, lat, lon) {
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

var diveSrc = readFile('dive-engine.js');
var htmlSrc = readFile('index.html');
var de = diveSrc, html = htmlSrc, dc = 0, fc = 0, log = [];

for (var mid in MANUAL) {
  if (!MANUAL.hasOwnProperty(mid)) continue;
  var m = MANUAL[mid];
  var dr = replaceDiveById(de, mid, m.lat, m.lon);
  if (dr.changed) { de = dr.text; dc++; log.push('DIVE ' + mid + ' -> ' + m.lat + ',' + m.lon); }
}

for (var fn in FISH_TO_DIVE) {
  if (!FISH_TO_DIVE.hasOwnProperty(fn)) continue;
  var fid = FISH_TO_DIVE[fn], mm = MANUAL[fid];
  if (!mm) continue;
  var hr = replaceFishByName(html, fn, mm.lat, mm.lon);
  if (hr.changed) { html = hr.text; fc++; log.push('FISH ' + fn + ' -> ' + mm.lat + ',' + mm.lon); }
}

writeFile('dive-engine.js', de);
writeFile('index.html', html);
WScript.Echo('Manual offshore sync: ' + dc + ' dive, ' + fc + ' fish');
if (log.length) WScript.Echo(log.join('\n'));
