// DISABLED 2026-07-27 — DO NOT RUN for production coords.
// Policy: never manually nudge/push lat/lon to pass audits. Replace from multi-source
// published GPS in verified-water-pins.json, or hide the pin. See water-pin-coords.mdc.
// Legacy script retained for history only.
WScript.Echo('REFUSED: apply-pv-water-fix.js is disabled (no coordinate nudges).');
WScript.Echo('Use verified-water-pins.json + apply-verified-pins.cjs, or hide unverified pins.');
WScript.Quit(1);
/* legacy body below (unreachable)
// Restore mega-pushed fish pins to authoritative water targets + nudge remaining
// true PV onshore failures (cap 900 m). Sync matching dive-engine / expand-libraries.
// Run: cscript //Nologo apply-pv-water-fix.js
*/
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('coast-audit-sanitize.js'));
COAST_GEO = CoastAuditSanitize.apply(COAST_GEO, root);
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function replaceFish(src, name, newLat, newLon) {
  var re = new RegExp(
    '(name:\\s*[\'"]' + escapeRe(name) + '[\'"][\\s\\S]{0,280}?lat:\\s*)' +
      '[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+',
    'm'
  );
  if (!re.test(src)) return { src: src, ok: false };
  return { src: src.replace(re, '$1' + LA.fmt7(newLat) + '$2' + LA.fmt7(newLon)), ok: true };
}

function replaceDive(src, id, newLat, newLon) {
  var re = new RegExp(
    "(\\{\\s*id:\\s*'" + escapeRe(id) + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+"
  );
  if (!re.test(src)) return { src: src, ok: false };
  return { src: src.replace(re, '$1' + LA.fmt7(newLat) + '$2' + LA.fmt7(newLon)), ok: true };
}

function replaceExpand(src, id, newLat, newLon) {
  var re = new RegExp(
    "(\\{\\s*id:\\s*'" + escapeRe(id) + "'[^\\}]*?lat:\\s*)[\\d.eE+-]+(\\s*,\\s*lon:\\s*)[\\d.eE+-]+"
  );
  if (!re.test(src)) return { src: src, ok: false };
  return { src: src.replace(re, '$1' + LA.fmt7(newLat) + '$2' + LA.fmt7(newLon)), ok: true };
}

function fishStrict(lat, lon, name) {
  if (/Artificial Reef/i.test(name || '')) return { fail: false };
  var oi = LA.onIsland(lat, lon);
  if (oi) return { fail: true, why: 'islandLand ' + oi };
  if (LA.isSPBay(lat, lon)) return { fail: false };
  if (LA.isOnLand(lat, lon)) return { fail: true, why: 'isOnLand' };
  var loc = LA.localEastM(lat, lon);
  var pvSea = LA.pvSeawardM(lat, lon);
  if (pvSea != null) {
    if (pvSea < 120) return { fail: true, why: 'bluffPV sea=' + Math.round(pvSea), loc: loc };
    return { fail: false, loc: loc };
  }
  if (loc.distM < 2500 && loc.eastM > 50) return { fail: true, why: 'localEast+' + loc.eastM, loc: loc };
  if (LA.isEastOfShoreline(lat, lon) && !LA.isOCGap(lat, lon)) {
    return { fail: true, why: 'eastOfShoreline', loc: loc };
  }
  if (loc.distM < 350 && loc.eastM > -150) {
    return { fail: true, why: 'nearCoast dist=' + loc.distM + ' east=' + loc.eastM, loc: loc };
  }
  return { fail: false, loc: loc };
}

function nudgeToWater(lat, lon, face, name) {
  var dirs = [face || 270, 200, 210, 220, 225, 240, 250, 260, 270, 280, 190, 180];
  var d, di, p, check;
  for (di = 0; di < dirs.length; di++) {
    for (d = 80; d <= 900; d += 40) {
      p = LA.destPt(lat, lon, dirs[di], d);
      check = fishStrict(p.lat, p.lon, name);
      if (!check.fail) {
        return { lat: LA.fmt7(p.lat), lon: LA.fmt7(p.lon), pushM: d, dir: dirs[di] };
      }
    }
  }
  return null;
}

/**
 * Authoritative / Esri-aligned in-water targets (≥~120 m west of PV west shore).
 * Restores San Pedro / PVR as-built (prior agent wrongly NW-pushed onto PV).
 */
var FISH_FIX = {
  'White Point / Royal Palms reef': { lat: 33.7139958, lon: -118.3625655, face: 200 },
  'Pipeline wreck fish grounds — PV': { lat: 33.7147178, lon: -118.3682872, face: 190 },
  'Point Fermin outer reef fish': { lat: 33.7125754, lon: -118.3659367, face: 200 },
  'PVR Restoration Reef — Module 5C': { lat: 33.7204718, lon: -118.352473, face: 190 },
  'PVR Restoration Reef Module 3 fish': { lat: 33.7194958, lon: -118.3495634, face: 190 },
  'PVR Restoration Reef Module 7 fish': { lat: 33.7214958, lon: -118.3545626, face: 190 },

  'Abalone Cove offshore kelp (PV)': { lat: 33.7495, lon: -118.4165, face: 200 },
  'Abalone Cove outer pinnacle fish — PV': { lat: 33.7482, lon: -118.4188, face: 200 },
  'Forrestal Cove kelp — PV': { lat: 33.7448, lon: -118.4168, face: 200 },
  'Sacred Cove outer reef fish — PV': { lat: 33.7512, lon: -118.4175, face: 210 },
  'Inspiration Point offshore kelp fish — PV': { lat: 33.7518, lon: -118.4172, face: 200 },
  'Palos Verdes Shores kelp — PV': { lat: 33.77415, lon: -118.4305, face: 255 },
  'Palos Verdes Cove kelp — PV': { lat: 33.7535, lon: -118.4168, face: 200 },
  'Pelican Cove kelp — PV': { lat: 33.7412, lon: -118.4105, face: 215 },
  'Terranea Cove kelp — PV': { lat: 33.7322, lon: -118.4178, face: 205 },
  'Old Marineland Cove kelp — PV': { lat: 33.7325, lon: -118.4175, face: 200 },
  'Portuguese Point offshore kelp — PV': { lat: 33.7335, lon: -118.4185, face: 210 },
  'Pt Vicente outer pinnacles fish — PV': { lat: 33.7325, lon: -118.4195, face: 225 },
  'Lunada Bay kelp — PV north': { lat: 33.7683972, lon: -118.4273943, face: 230 },
  'Lunada Bay outer reef fish — PV': { lat: 33.7674141, lon: -118.4294252, face: 230 },
  'Bluff Cove kelp — PV': { lat: 33.77715, lon: -118.4225, face: 250 },
  'Wayside Park kelp — PV': { lat: 33.77722, lon: -118.4228, face: 250 },
  'Malaga Cove outer kelp fish — PV': { lat: 33.77665, lon: -118.4232, face: 265 },
  'Long Point offshore kelp fish — PV': { lat: 33.7725, lon: -118.4285, face: 225 },
  'RPV offshore kelp bar fish — PV': { lat: 33.7734, lon: -118.4288, face: 250 },
  'Inspiration Point kelp — PV': { lat: 33.7532, lon: -118.4165, face: 200 }
};

var DIVE_FIX = {
  forrestal: { lat: 33.7448, lon: -118.4168 },
  pvshores: { lat: 33.77415, lon: -118.4305 },
  pvcove: { lat: 33.7535, lon: -118.4168 },
  pelicancove: { lat: 33.7412, lon: -118.4105 },
  terranea: { lat: 33.7322, lon: -118.4178 },
  oldmarineland: { lat: 33.7325, lon: -118.4175 },
  portugueseoff: { lat: 33.7335, lon: -118.4185 },
  sacredoff: { lat: 33.7512, lon: -118.4175 },
  abaloneoff: { lat: 33.7482, lon: -118.4188 },
  ptvicenteoff: { lat: 33.7325, lon: -118.4195 },
  inspirationoff: { lat: 33.7518, lon: -118.4172 },
  inspiration: { lat: 33.7532, lon: -118.4165 },
  sacred: { lat: 33.7518, lon: -118.4155 },
  abalone: { lat: 33.7495, lon: -118.4165 },
  portuguese: { lat: 33.7345, lon: -118.4168 },
  bluffcove: { lat: 33.77715, lon: -118.4225 },
  haggerty: { lat: 33.77715, lon: -118.4225 },
  malaga: { lat: 33.77722, lon: -118.4228 },
  malagaoff: { lat: 33.77665, lon: -118.4232 },
  wayside: { lat: 33.77722, lon: -118.4228 },
  torrance: { lat: 33.77465, lon: -118.4225 },
  longpointpv: { lat: 33.7725, lon: -118.4285 },
  rpvoffshore: { lat: 33.7734, lon: -118.4288 },
  flatrock: { lat: 33.7744, lon: -118.4285 },
  whitepoint: { lat: 33.7139958, lon: -118.3625655 },
  pipeline: { lat: 33.7147178, lon: -118.3682872 },
  ptferminoff: { lat: 33.7125754, lon: -118.3659367 },
  pvrrestoration: { lat: 33.7204718, lon: -118.352473 },
  pvrestmod3: { lat: 33.7194958, lon: -118.3495634 },
  pvrestmod7: { lat: 33.7214958, lon: -118.3545626 }
};

var html = readFile('index.html');
var dive = readFile('dive-engine.js');
var expand = readFile('scripts\\expand-libraries.mjs');
var nFish = 0, nDive = 0, nExp = 0, nNudge = 0, name, id, t, rep, sug, check;

for (name in FISH_FIX) {
  if (!FISH_FIX.hasOwnProperty(name)) continue;
  t = FISH_FIX[name];
  check = fishStrict(t.lat, t.lon, name);
  if (check.fail) {
    sug = nudgeToWater(t.lat, t.lon, t.face, name);
    if (sug) {
      WScript.Echo('NUDGE fish ' + name + ' ' + t.lat + ',' + t.lon + ' -> ' + sug.lat + ',' + sug.lon +
        ' (+' + sug.pushM + 'm @' + sug.dir + ') was ' + check.why);
      t = { lat: +sug.lat, lon: +sug.lon, face: t.face };
      nNudge++;
    } else {
      WScript.Echo('WARN fish still bad (no nudge<=900m): ' + name + ' | ' + check.why);
    }
  }
  rep = replaceFish(html, name, t.lat, t.lon);
  if (rep.ok) { html = rep.src; nFish++; WScript.Echo('FISH ' + name + ' -> ' + t.lat + ',' + t.lon); }
  else WScript.Echo('MISS fish ' + name);
}

for (id in DIVE_FIX) {
  if (!DIVE_FIX.hasOwnProperty(id)) continue;
  t = DIVE_FIX[id];
  /* Keep dive in sync with final fish water when same id intent */
  rep = replaceDive(dive, id, t.lat, t.lon);
  if (rep.ok) { dive = rep.src; nDive++; WScript.Echo('DIVE ' + id + ' -> ' + t.lat + ',' + t.lon); }
  else WScript.Echo('MISS dive ' + id);
  rep = replaceExpand(expand, id, t.lat, t.lon);
  if (rep.ok) { expand = rep.src; nExp++; }
}

writeFile('index.html', html);
writeFile('dive-engine.js', dive);
writeFile('scripts\\expand-libraries.mjs', expand);
WScript.Echo('');
WScript.Echo('Updated fish=' + nFish + ' dive=' + nDive + ' expand=' + nExp + ' nudges=' + nNudge);
