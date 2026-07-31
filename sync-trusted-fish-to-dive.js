/**
 * Promote dive-worthy trusted FISH_SPOTS into DIVE_SITES.
 * Trust tiers only: userTrusted and/or kmlImported (coords copied verbatim — no nudges).
 * Usage: cscript //Nologo sync-trusted-fish-to-dive.js
 *
 * Does NOT set verified:true (that requires dual-source log in verified-water-pins.json).
 * Skips holds: Star of Scotland, Stony Point, numbered fishing spots, pipes, Mexico <32.5, etc.
 */
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

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

function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function slugId(name, i) {
  var s = String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .substring(0, 26);
  if (!s) s = 'spot';
  return 'ut_' + s + '_' + i;
}

function parseDepth(raw) {
  if (raw == null) return 50;
  if (typeof raw === 'number' && isFinite(raw)) return Math.round(raw);
  var m = String(raw).match(/(\d+)\s*-\s*(\d+)/);
  if (m) return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
  m = String(raw).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 50;
}

function guessFace(lat, lon) {
  if (lat >= 33.2 && lat <= 33.55 && lon <= -118.25 && lon >= -118.65) return 90; /* Catalina frontside */
  if (lat >= 33.2 && lat <= 33.55 && lon < -118.45) return 270; /* Catalina west/back */
  if (lat >= 33.9 && lon < -119.2) return 180; /* Channel Islands */
  if (lat < 33.0 && lon > -117.5) return 280; /* SD */
  if (lon > -117.7) return 200; /* OC */
  if (lat >= 33.7 && lat <= 34.1) return 250;
  return 250;
}

function isRegional(lat, lon) {
  if (lat >= 32.4 && lat <= 33.25) return true;
  if (lat >= 33.25 && lat <= 33.65 && lon > -118.15) return true;
  if (lat >= 34.0 && lon < -118.5) return true;
  if (lat > 34.1) return true;
  if (lat >= 33.2 && lat <= 33.55 && lon < -118.25) return true; /* Catalina */
  if (lat >= 32.7 && lat <= 33.15 && lon < -118.2) return true; /* SCI */
  return false;
}

function isHoldName(name) {
  var n = String(name || '');
  if (/Star of Scotland/i.test(n)) return true;
  if (/Stony Point/i.test(n)) return true;
  if (/Resort Point/i.test(n)) return true;
  if (/Kevin'?s Reef/i.test(n)) return true;
  if (/Neptune\s*(Arch|Cove)/i.test(n)) return true;
  if (/Jenny\s*Lynne/i.test(n)) return true;
  if (/International Reef/i.test(n)) return true;
  if (/Bird Rock Reef/i.test(n)) return true; /* CDN-only hold; Isthmus Bird Rock already in dive */
  return false;
}

function isExcludedFishingNoise(name) {
  var n = String(name || '');
  if (/^\d+\s*(Spot|Bubbles)?$/i.test(n)) return true;
  if (/^\d{2,3}$/.test(n.replace(/\s/g, ''))) return true;
  if (/\bPipe\b/i.test(n) && !/Pipeline Wreck/i.test(n)) return true;
  if (/\bFathom\b/i.test(n)) return true;
  if (/Powerplant/i.test(n)) return true;
  if (/Rosarito/i.test(n)) return true;
  if (/\bShiners\b/i.test(n)) return true;
  if (/squid zone/i.test(n)) return true;
  if (/\bFlats\b/i.test(n) && !/Hardbottom|Hard Bottom/i.test(n)) return true;
  if (/Hotel Coral Marina/i.test(n)) return true;
  if (/Dana Harbor$/i.test(n)) return true;
  if (/Oceanside Harbor$/i.test(n)) return true;
  if (/Ingrahm Street Bridge/i.test(n)) return true;
  if (/Mission Bay Jetty/i.test(n)) return true;
  return false;
}

function isDiveWorthy(name) {
  var n = String(name || '');
  if (isHoldName(n) || isExcludedFishingNoise(n)) return false;
  /* Famous / structural dive destinations */
  if (/\b(Reef|Kelp|Wreck|Bank|Pinnacle|Rocks?|Cove|Point|Harbor|Gardens|Cavern|Arch|Wall|Quarry|Landing|Canyon)\b/i.test(n)) return true;
  if (/\b(Catalina|Anacapa|Santa Cruz|Santa Barbara|San Clemente|Isthmus|Avalon|Pyramid|Smuggler|Forney|Carrington|Windansea|Swami|La Jolla|Marineland|Horseshoe|Farnsworth|Eagle|Goat|Church|Hen|Italian|China Point|West End|Iron Bound|Desperation|Cluster|Chinese Harbor|Ben Weston|Starlight|Salta Verde|Palisades|Lions Head|Gallagher|Silver Canyon|Seal Rocks|Slide)\b/i.test(n)) return true;
  if (/\b(Paradise Cove|Crystal Cove|Barn Kelp|Big Kelp|BKR|Venice|Ocean Park|Del Mar|Imperial Beach|Point Loma|Rocky Point|Vicente|Fermin|Bull Kelp|Olympic)\b/i.test(n)) return true;
  return false;
}

function parseJsonSafe(n) {
  try {
    var t = readFile(n);
    if (t.charCodeAt(0) === 0xFEFF) t = t.substring(1);
    return eval('(' + t + ')');
  } catch (e) { return null; }
}

function isLiveExcluded(name, lat, lon) {
  var doc = parseJsonSafe('pin-trust-live-exclusions.json');
  if (!doc) return false;
  var lists = [].concat(doc.no || [], doc.unsure || []);
  for (var i = 0; i < lists.length; i++) {
    var r = lists[i];
    if (!r) continue;
    if (String(r.name) === String(name) &&
        haversineNm(r.lat, r.lon, lat, lon) < 0.05) return true;
  }
  return false;
}

var dash = readFile('index.html');
var fish = extractArray(dash, 'FISH_SPOTS');
if (!fish) throw new Error('FISH_SPOTS parse failed');

var diveJs = readFile('dive-engine.js');
var dive = extractArray(diveJs, 'DIVE_SITES');
if (!dive) throw new Error('DIVE_SITES parse failed');

var added = [];
var skipped = [];
var newLines = [];
var nearDupNm = 0.05;

for (var i = 0; i < fish.length; i++) {
  var f = fish[i];
  if (!f || !isFinite(f.lat) || !isFinite(f.lon)) continue;
  if (!(f.userTrusted || f.kmlImported)) continue;
  if (isLiveExcluded(f.name, f.lat, f.lon)) {
    skipped.push(f.name + ' (pin-trust no/unsure exclude)');
    continue;
  }
  if (f.lat < 32.5) { skipped.push(f.name + ' (mexico/south)'); continue; }
  if (!isDiveWorthy(f.name)) { skipped.push(f.name + ' (not dive-worthy filter)'); continue; }

  /* Skip KML Hen Rock mislabel of Long Point (keep dual CDN henrock + longpoint) */
  if (/Hen Rock/i.test(String(f.name || '')) &&
      haversineNm(f.lat, f.lon, 33.4057667, -118.3666667) < 0.15) {
    skipped.push(f.name + ' (Hen Rock near Long Point CDN — mislabel)');
    continue;
  }

  /* Prefer userTrusted; allow kmlImported-only for famous names already passing isDiveWorthy */
  if (!f.userTrusted && !f.kmlImported) continue;

  var near = false;
  for (var d = 0; d < dive.length; d++) {
    var s = dive[d];
    if (!s || !isFinite(s.lat)) continue;
    if (haversineNm(f.lat, f.lon, s.lat, s.lon) < nearDupNm) { near = true; break; }
  }
  if (near) { skipped.push(f.name + ' (near existing dive)'); continue; }

  var id = slugId(f.name, i);
  var depth = parseDepth(f.depth);
  var face = (typeof f.face === 'number' && isFinite(f.face)) ? f.face : guessFace(f.lat, f.lon);
  var parts = [
    "id: '" + id + "'",
    "name: '" + escJs(f.name) + "'",
    'lat: ' + f.lat,
    'lon: ' + f.lon,
    'face: ' + face,
    'depth: ' + depth,
    'boat: true'
  ];
  if (f.userTrusted) parts.push('userTrusted: true');
  if (f.kmlImported) parts.push('kmlImported: true');
  if (isRegional(f.lat, f.lon) || f.regional) parts.push('regional: true');

  newLines.push('    { ' + parts.join(', ') + ' }');
  dive.push({ name: f.name, lat: f.lat, lon: f.lon, userTrusted: !!f.userTrusted });
  added.push(f.name + (f.userTrusted ? ' [userTrusted]' : ' [kml]'));
}

if (newLines.length) {
  var end = diveJs.indexOf('];', diveJs.indexOf('const DIVE_SITES = ['));
  diveJs = diveJs.substring(0, end).replace(/\s*$/, '') +
    ',\n    /* —— Trusted fish→dive sync (userTrusted / kmlImported; coords verbatim) —— */\n' +
    newLines.join(',\n') + '\n  ];' + diveJs.substring(end + 2);
  writeFile('dive-engine.js', diveJs);
}

WScript.Echo('Added trusted fish→dive sites: ' + added.length);
WScript.Echo('Dive total now ~' + dive.length);
for (var a = 0; a < Math.min(40, added.length); a++) WScript.Echo('  + ' + added[a]);
if (added.length > 40) WScript.Echo('  ... +' + (added.length - 40) + ' more');
WScript.Echo('Skipped (sample): ' + Math.min(15, skipped.length) + ' of ' + skipped.length);
for (var b = 0; b < Math.min(15, skipped.length); b++) WScript.Echo('  - ' + skipped[b]);
