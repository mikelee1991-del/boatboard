// Second pass — fix remaining audit failures
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
  golfball: { lat: 33.8082500, lon: -118.4224833 },
  horseshoe: { lat: 33.7180000, lon: -118.3780000 },
  manhattan: { lat: 33.8844444, lon: -118.4306667 },
  thecrane: { lat: 33.8049333, lon: -118.4220000 },
  olympic2: { lat: 33.7058333, lon: -118.3688333 },
  elporto: { lat: 33.8850000, lon: -118.4320000 },
  barge272: { lat: 33.6958167, lon: -118.1755333 },
  pebblybeach: { lat: 33.3077704, lon: -118.3530773 },
  moonstone: { lat: 33.3146187, lon: -118.3610881 },
  buttonshell: { lat: 33.3088500, lon: -118.3535413 },
  quarrycove: { lat: 33.2984646, lon: -118.3247815 },
  smugglers: { lat: 34.0283318, lon: -119.6083658 },
  frysharbor: { lat: 34.0399989, lon: -119.6096127 },
  santarosa: { lat: 33.9883333, lon: -120.1108333 },
  oceanside: { lat: 33.1958333, lon: -117.4058333 },
  merrysreef: { lat: 33.7640958, lon: -118.3944132 },
  kevinsreef: { lat: 33.7616791, lon: -118.3931641 }
};

var FISH_TO_DIVE = {
  'Horseshoe Kelp': 'horseshoe',
  'Manhattan Beach / El Porto halibut flats': 'manhattan',
  "Golf Ball Reef — Fermin Point kelp": 'golfball',
  'Oceanside nearshore kelp': 'oceanside',
  "Merry's Reef kelp — Honeymoon Cove": 'merrysreef',
  "The Crane — Haggerty's offshore": 'thecrane',
  "Kevin's Reef — Christmas Tree Cove offshore": 'kevinsreef',
  'Olympic II wreck — Horseshoe Kelp': 'olympic2',
  'Pebbly Beach kelp — Catalina': 'pebblybeach',
  'Moonstone Beach kelp — Catalina': 'moonstone',
  'Buttonshell Beach kelp — Catalina': 'buttonshell',
  'Quarry Cove kelp — Catalina NE': 'quarrycove',
  'El Porto reef fish — Manhattan': 'elporto',
  'Barge 272 reef fish — San Pedro Bay': 'barge272',
  'Smugglers Cove kelp — Santa Cruz Is.': 'smugglers',
  "Fry's Harbor kelp — Santa Cruz Is.": 'frysharbor',
  "Bechers Bay kelp — Santa Rosa Is.": 'santarosa',
  "Kevin's Reef fish — PV offshore": 'kevinsreef'
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

var de = readFile('dive-engine.js');
var html = readFile('index.html');
var dc = 0, fc = 0, log = [];

for (var mid in MANUAL) {
  if (!MANUAL.hasOwnProperty(mid)) continue;
  var m = MANUAL[mid];
  var dr = replaceDiveById(de, mid, m.lat, m.lon);
  if (dr.changed) { de = dr.text; dc++; log.push('DIVE ' + mid); }
}

for (var fn in FISH_TO_DIVE) {
  if (!FISH_TO_DIVE.hasOwnProperty(fn)) continue;
  var fid = FISH_TO_DIVE[fn], mm = MANUAL[fid];
  if (!mm) continue;
  var hr = replaceFishByName(html, fn, mm.lat, mm.lon);
  if (hr.changed) { html = hr.text; fc++; log.push('FISH ' + fn); }
}

writeFile('dive-engine.js', de);
writeFile('index.html', html);
WScript.Echo('Pass5: ' + dc + ' dive, ' + fc + ' fish');
WScript.Echo(log.join('\n'));
