// DISABLED 2026-07-27 — DO NOT RUN for production coords (no suggestOffshore applies).
WScript.Echo('REFUSED: fix-dive-pv-water-pass2.js is disabled (no coordinate nudges).');
WScript.Quit(1);
/* legacy
// Auto-fix PV dive sites to authoritative water coords from comments + suggestOffshore
*/
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { fso.CreateTextFile(root + '\\' + n, true).Write(c); }
var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

// Authoritative in-water targets parsed from dive-engine comments / CDFG / USC / diver.net
var FIX = {
  honeymoon: { lat: 33.7641, lon: -118.4268667 },
  merrysreef: { lat: 33.7641, lon: -118.4268667 },
  christmastree: { lat: 33.761, lon: -118.419 },
  kevinsreef: { lat: 33.7616833, lon: -118.4256167 },
  neptune: { lat: 33.7512667, lon: -118.4178333 },
  littleflower: { lat: 33.7545883, lon: -118.4178333 },
  littlefloweroff: { lat: 33.7545883, lon: -118.4208333 },
  ptvicente: { lat: 33.7388, lon: -118.4149167 },
  pvcaves: { lat: 33.7385333, lon: -118.4149167 },
  ptvicenteoff: { lat: 33.7332436, lon: -118.416104 },
  rockypoint: { lat: 33.7705, lon: -118.4353333 },
  dominator: { lat: 33.7738889, lon: -118.4283333 },
  wormreef: { lat: 33.7711, lon: -118.4343 },
  resortpoint: { lat: 33.76455, lon: -118.428 },
  halfway: { lat: 33.76265, lon: -118.4255667 },
  hawthorne: { lat: 33.7469, lon: -118.4205667 },
  marguerite: { lat: 33.757, lon: -118.418 },
  lunada: { lat: 33.7683972, lon: -118.4273943 },
  lunadaoff: { lat: 33.7674141, lon: -118.4294252 },
  sacred: { lat: 33.752989, lon: -118.4108264 },
  sacredoff: { lat: 33.752489, lon: -118.4138264 },
  abalone: { lat: 33.750789, lon: -118.4126593 },
  abaloneoff: { lat: 33.749489, lon: -118.4158257 },
  inspiration: { lat: 33.7543994, lon: -118.4109455 },
  inspirationoff: { lat: 33.7530754, lon: -118.4139451 },
  pvcove: { lat: 33.7550266, lon: -118.4102479 },
  forrestal: { lat: 33.7469537, lon: -118.4114348 },
  horseshoe: { lat: 33.7471836, lon: -118.4101036 },
  haggerty: { lat: 33.7771469, lon: -118.4113986 },
  bluffcove: { lat: 33.7771469, lon: -118.4113986 },
  malaga: { lat: 33.7772204, lon: -118.4115 },
  malagaoff: { lat: 33.7766469, lon: -118.4118986 },
  pvshores: { lat: 33.7741469, lon: -118.411899 },
  torrance: { lat: 33.7746469, lon: -118.4118989 },
  wayside: { lat: 33.7772204, lon: -118.4115 },
  longpointpv: { lat: 33.7729958, lon: -118.4125431 },
  rpvoffshore: { lat: 33.7734078, lon: -118.4128593 },
  flatrock: { lat: 33.7744274, lon: -118.4128791 },
  valiant: { lat: 33.7746738, lon: -118.4125431 },
  kaplancove: { lat: 33.7378333, lon: -118.4115846 },
  oldmarineland: { lat: 33.7335103, lon: -118.411071 },
  terranea: { lat: 33.7336167, lon: -118.4108245 },
  portuguese: { lat: 33.7359438, lon: -118.4123905 },
  portugueseoff: { lat: 33.7344958, lon: -118.4145577 },
  hermosa: { lat: 33.8541667, lon: -118.4138889 },
  thecrane: { lat: 33.8049333, lon: -118.409 },
  golfball: { lat: 33.80825, lon: -118.4094833 },
  cabrillo: { lat: 33.7125754, lon: -118.3409367 },
  ptferminoff: { lat: 33.7125754, lon: -118.3439367 },
  pelicancove: { lat: 33.7294957, lon: -118.3657334 },
  whitepoint: { lat: 33.7139958, lon: -118.3355655 },
  yellowtail: { lat: 33.7245754, lon: -118.3754375 },
  pipeline: { lat: 33.7147178, lon: -118.3552872 },
  wreck140: { lat: 33.7191667, lon: -118.3553333 },
  pvrrestoration: { lat: 33.7204718, lon: -118.352473 },
  pvrestmod3: { lat: 33.7194958, lon: -118.3495634 },
  pvrestmod7: { lat: 33.7214958, lon: -118.3545626 },
  hermosa: { lat: 33.8541667, lon: -118.4202778 },
  whitepoint: { lat: 33.7139958, lon: -118.3625655 },
  golfball: { lat: 33.80825, lon: -118.4154833 },
  yellowtail: { lat: 33.7245754, lon: -118.3954375 },
  cabrillo: { lat: 33.7125754, lon: -118.3629367 },
  ptferminoff: { lat: 33.7125754, lon: -118.3659367 },
  pelicancove: { lat: 33.7294957, lon: -118.3827334 },
  pipeline: { lat: 33.7147178, lon: -118.3682872 },
  wreck140: { lat: 33.7191667, lon: -118.3683333 },
  thecrane: { lat: 33.8049333, lon: -118.415 },
  pvrrestoration: { lat: 33.7204718, lon: -118.352473 }
};

var src = readFile('dive-engine.js');
var n = 0;
for (var id in FIX) {
  if (!FIX.hasOwnProperty(id)) continue;
  var c = FIX[id];
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(src)) { WScript.Echo('MISSING ' + id); continue; }
  re.lastIndex = 0;
  src = src.replace(re, '$1' + c.lat + '$2' + c.lon);
  n++;
  WScript.Echo('fixed ' + id + ' -> ' + c.lat + ',' + c.lon);
}
writeFile('dive-engine.js', src);
WScript.Echo('Updated ' + n + ' sites');
