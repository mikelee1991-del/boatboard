// Push bluffPV spots offshore via suggestOffshore from best-known coords
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var SEEDS = [
  { name: 'Valiant wreck fish grounds', lat: 33.7746738, lon: -118.425, face: 250 },
  { name: 'Resort Point kelp wall — PV', lat: 33.7645497, lon: -118.4193457, face: 230 },
  { name: 'Lunada Bay outer reef fish — PV', lat: 33.7674141, lon: -118.4201485, face: 230 },
  { name: 'Marguerite Cove kelp — PV', lat: 33.7566879, lon: -118.4138892, face: 220 },
  { name: 'Horseshoe Kelp', lat: 33.718, lon: -118.358, face: 270 },
  { name: 'Marineland Reef 80ft', lat: 33.734, lon: -118.401, face: 250 },
  { name: 'Vicente Outside Rock 80ft', lat: 33.7388, lon: -118.415, face: 250 },
  { name: 'Sand Bass Junction', lat: 33.6843, lon: -118.1288, face: 270 },
  { name: 'San Onofre', lat: 33.348, lon: -117.5675, face: 270 },
  { name: 'Golf Ball Reef — Fermin Point kelp', lat: 33.80825, lon: -118.4094833, face: 180 },
  { name: 'Manhattan Beach / El Porto halibut flats', lat: 33.8844444, lon: -118.4166667, face: 270 },
  { name: 'El Porto reef fish — Manhattan', lat: 33.885, lon: -118.418, face: 250 },
  { name: "The Crane — Haggerty's offshore", lat: 33.8049333, lon: -118.409, face: 250 }
];

function replaceFishByName(text, name, lat, lon) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("(name:\\s*'" + esc + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(text)) return { text: text, changed: false };
  re.lastIndex = 0;
  return { text: text.replace(re, '$1' + lat + '$2' + lon), changed: true };
}

var html = readFile('index.html');
var log = [], n = 0;

for (var i = 0; i < SEEDS.length; i++) {
  var s = SEEDS[i];
  var sug = LA.nudgeOffshore(s.lat, s.lon, s.face);
  if (!sug) sug = LA.suggestOffshore(s.lat, s.lon, s.face);
  if (!sug) {
    log.push('NO SUG ' + s.name);
    continue;
  }
  var loc = LA.localEastM(sug.lat, sug.lon);
  var r = replaceFishByName(html, s.name, sug.lat, sug.lon);
  if (r.changed) {
    html = r.text; n++;
    log.push(s.name + ': ' + s.lat + ',' + s.lon + ' -> ' + sug.lat + ',' + sug.lon + ' (' + sug.pushM + 'm @' + sug.dir + ' localEast=' + loc.eastM + ')');
  }
}

writeFile('index.html', html);
WScript.Echo('Applied ' + n + ' suggestOffshore fixes');
WScript.Echo(log.join('\n'));
