// Apply authoritative in-water dive coords — cscript //Nologo fix-dive-water-coords.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { fso.CreateTextFile(root + '\\' + n, true).Write(c); }

// id -> { lat, lon } water-side targets (6-7 decimals)
var FIX = {
  veterans: { lat: 33.8383326, lon: -118.4268816 },
  kingharbor: { lat: 33.8347222, lon: -118.4280000 },
  honeymoon: { lat: 33.7640958, lon: -118.3944132 },
  ptvicente: { lat: 33.7464292, lon: -118.4062110 },
  pvcaves: { lat: 33.7468292, lon: -118.4072110 },
  sacred: { lat: 33.7529890, lon: -118.3978264 },
  lunada: { lat: 33.7683969, lon: -118.4124252 },
  cabrillo: { lat: 33.7215754, lon: -118.3179367 },
  neptune: { lat: 33.7512651, lon: -118.3929560 },
  valiant: { lat: 33.7746738, lon: -118.4055431 },
  resortpoint: { lat: 33.7645497, lon: -118.4124252 },
  christmastree: { lat: 33.7616791, lon: -118.3931641 },
  marguerite: { lat: 33.7566879, lon: -118.4055431 },
  halfway: { lat: 33.7658290, lon: -118.4185739 },
  dominator: { lat: 33.7738847, lon: -118.3937123 },
  oldmarineland: { lat: 33.7335103, lon: -118.4080710 },
  kaplancove: { lat: 33.7456306, lon: -118.4065846 },
  pelicancove: { lat: 33.7314957, lon: -118.3207334 },
  pvcove: { lat: 33.7550266, lon: -118.3972479 },
  terranea: { lat: 33.7336167, lon: -118.4078245 },
  forrestal: { lat: 33.7469537, lon: -118.4064348 },
  longpointpv: { lat: 33.7729958, lon: -118.4055431 },
  lunadaoff: { lat: 33.7674141, lon: -118.4124252 },
  ptvicenteoff: { lat: 33.7332436, lon: -118.4081040 },
  playadelrey: { lat: 33.9263139, lon: -118.4720000 }
};

var src = readFile('dive-engine.js');
var n = 0;
for (var id in FIX) {
  if (!FIX.hasOwnProperty(id)) continue;
  var c = FIX[id];
  var re = new RegExp("(\\{\\s*id:\\s*'" + id + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+");
  if (!re.test(src)) { WScript.Echo('MISSING id: ' + id); continue; }
  re.lastIndex = 0;
  src = src.replace(re, '$1' + c.lat + '$2' + c.lon);
  n++;
  WScript.Echo('fixed ' + id + ' -> ' + c.lat + ',' + c.lon);
}
writeFile('dive-engine.js', src);
WScript.Echo('Updated ' + n + ' dive sites');
