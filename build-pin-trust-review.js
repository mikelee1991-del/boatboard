// Build pin-trust-review-data.js — candidates for manual yes/no/unsure review.
// Usage: cscript //Nologo build-pin-trust-review.js
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }
function fileExists(n) { return fso.FileExists(root + '\\' + n); }

var COAST_GEO = {};
eval(readFile('coast-geo.js').replace(/window\.COAST_GEO/g, 'COAST_GEO'));
eval(readFile('location-audit-core.js'));
LocationAudit.init(COAST_GEO);
var LA = LocationAudit;

var SLIP = { lat: 33.8481667, lon: -118.3963333 };

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

function escJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function shoreDistM(lat, lon) {
  try {
    var loc = LA.localEastM(lat, lon);
    return loc && isFinite(loc.distM) ? loc.distM : null;
  } catch (e) { return null; }
}

function suspectName(name) {
  return /pier|beach|harbor|harbour|cove|jetty|pipe|point|marina|flats|anchorage|breakwater|wharf|dock|ramp|park|steps|hotel|streets|main beach|crystal pier|windansea|swami/i.test(name || '');
}

function parseOmitted() {
  if (!fileExists('kml-onshore-omitted.json')) return [];
  var t = readFile('kml-onshore-omitted.json');
  if (t.charCodeAt(0) === 0xFEFF) t = t.substring(1);
  var o = eval('(' + t + ')');
  return o.omitted || [];
}

var html = readFile('index.html');
var diveJs = readFile('dive-engine.js');
var fish = extractArray(html, 'FISH_SPOTS') || [];
var dive = extractArray(diveJs, 'DIVE_SITES') || [];
var omitted = parseOmitted();

/* Site intel for About blurbs (notes / structure / briefing — never invent GPS) */
if (typeof window === 'undefined') var window = {};
try { eval(readFile('dive-site-intel.js')); } catch (eIntel) { }
try { eval(readFile('dive-briefings-data.js')); } catch (eBrief) { }
var DIVE_INTEL = window.__BOAT_DIVE_SITE_INTEL__ || {};
var DIVE_BRIEF = window.__BOAT_DIVE_BRIEFINGS__ || {};

function firstSentences(text, maxN) {
  var t = String(text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  if (!t) return '';
  var parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts || !parts.length) return t;
  var out = [], i, s;
  for (i = 0; i < parts.length && out.length < (maxN || 2); i++) {
    s = parts[i].replace(/^\s+|\s+$/g, '');
    if (s) out.push(s);
  }
  return out.join(' ');
}

function findDiveRow(c) {
  var id = c.diveId || '';
  if (!id && c.id && String(c.id).indexOf('dive_') === 0) {
    id = String(c.id).replace(/^dive_(ver_)?/, '');
  }
  if (!id && c.id && String(c.id).indexOf('dive_ut_') === 0) {
    id = String(c.id).replace(/^dive_/, '');
  }
  var i, d;
  if (id) {
    for (i = 0; i < dive.length; i++) {
      d = dive[i];
      if (d && String(d.id) === String(id)) return d;
    }
  }
  for (i = 0; i < dive.length; i++) {
    d = dive[i];
    if (!d || d.name == null) continue;
    if (String(d.name) !== String(c.name)) continue;
    if (haversineNm(d.lat, d.lon, c.lat, c.lon) <= 0.05) return d;
  }
  return null;
}

function findFishRow(c) {
  var i, s;
  for (i = 0; i < fish.length; i++) {
    s = fish[i];
    if (!s || s.name == null) continue;
    if (String(s.name) !== String(c.name)) continue;
    if (haversineNm(s.lat, s.lon, c.lat, c.lon) <= 0.05) return s;
  }
  return null;
}

function asciiSafe(s) {
  return String(s || '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u00B7/g, '-')
    .replace(/\u2026/g, '...')
    /* Mojibake from cscript reading UTF-8 intel as ANSI */
    .replace(/â€“|â€”|Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')
    .replace(/â€˜|â€™|Ã¢â‚¬Ëœ|Ã¢â‚¬â„¢/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/Â·|Ã‚Â·/g, '-')
    .replace(/(\d)[^\d\w\s.:\/+-]{1,4}(\d)/g, '$1-$2')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}

function aboutForCandidate(c) {
  var bits = [], diveRow, fishRow, intel, brief, depthStr, faceStr, access;
  var intelKey = '', tryKeys = [], ki, k;
  if (c.kind === 'dive') {
    diveRow = findDiveRow(c);
    if (diveRow && diveRow.id) tryKeys.push(String(diveRow.id));
    if (c.diveId) tryKeys.push(String(c.diveId));
    if (c.id) {
      tryKeys.push(String(c.id).replace(/^dive_(ver_)?/, ''));
      tryKeys.push(String(c.id).replace(/^dive_ut_/, 'ut_'));
    }
    for (ki = 0; ki < tryKeys.length; ki++) {
      k = tryKeys[ki];
      if (k && DIVE_INTEL[k]) { intelKey = k; break; }
      if (k && DIVE_BRIEF[k]) { intelKey = k; break; }
    }
    if (intelKey && DIVE_INTEL[intelKey]) {
      intel = DIVE_INTEL[intelKey];
      if (intel.structure) bits.push(String(intel.structure));
      if (intel.notes) bits.push(firstSentences(intel.notes, 1));
      else if (intel.bestWhen) bits.push('Best: ' + firstSentences(intel.bestWhen, 1));
    }
    if (!bits.length && intelKey && DIVE_BRIEF[intelKey] && DIVE_BRIEF[intelKey].length) {
      brief = DIVE_BRIEF[intelKey][0];
      if (brief && brief.body && brief.body.length) bits.push(firstSentences(brief.body[0], 2));
    }
    if (!bits.length && diveRow) {
      depthStr = diveRow.depth != null ? ('~' + diveRow.depth + ' ft') : '';
      faceStr = diveRow.face != null ? ('face ' + diveRow.face + '\u00B0') : '';
      access = diveRow.boat ? 'boat dive' : 'shore/boat';
      bits.push(('Dive site - ' + [depthStr, faceStr, access].join(' - '))
        .replace(/ -  - /g, ' - ')
        .replace(/^ - | - $/g, ''));
    }
    if (!bits.length) {
      bits.push('Dive site - review candidate (no local intel brief yet).');
    }
  } else {
    fishRow = findFishRow(c);
    if (fishRow) {
      if (fishRow.habitat) bits.push(String(fishRow.habitat));
      if (fishRow.depth) bits.push('Depth ' + String(fishRow.depth));
      if (fishRow.tactics && !/pin-trust|user-trusted|San Diego Fishing Spots/i.test(fishRow.tactics)) {
        bits.push(firstSentences(fishRow.tactics, 1));
      }
    }
    if (!bits.length) {
      if (/kml/i.test(c.trustClass || '') || /San Diego Fishing Spots\.kml/i.test(c.source || '')) {
        bits.push('Fish waypoint - KML chart');
      } else if (/usc/i.test(c.trustClass || '')) {
        bits.push('Fish waypoint - USC Sea Grant listing');
      } else {
        bits.push('Fish waypoint - published chart / guide');
      }
      if (fishRow && fishRow.depth) bits.push('Depth ' + String(fishRow.depth));
    }
  }
  return asciiSafe(firstSentences(bits.join('. ').replace(/\.\./g, '.'), 2));
}

/* Prior export — reuse stable ids + seed verdicts into the review UI */
var priorDoc = null;
var priorByKey = {};
var priorById = {};
if (fileExists('pin-trust-review-results.json')) {
  try {
    var pt = readFile('pin-trust-review-results.json');
    if (pt.charCodeAt(0) === 0xFEFF) pt = pt.substring(1);
    priorDoc = eval('(' + pt + ')');
    var pr = (priorDoc && priorDoc.results) || [];
    for (var pi = 0; pi < pr.length; pi++) {
      var prow = pr[pi];
      if (!prow || !prow.id) continue;
      priorById[prow.id] = prow;
      priorByKey[(prow.kind || '') + '|' + prow.name + '|' + prow.lat + '|' + prow.lon] = prow;
    }
  } catch (ePrior) { priorDoc = null; }
}

function liveDisplayed(kind, name, lat, lon) {
  var arr = kind === 'dive' ? dive : fish;
  for (var i = 0; i < arr.length; i++) {
    var s = arr[i];
    if (!s || s.lat == null || s.lon == null) continue;
    /* Prefer coords — FSO OpenTextFile can mojibake em dashes in names vs UTF-8 JSON */
    if (haversineNm(s.lat, s.lon, lat, lon) <= 0.05) return true;
  }
  return false;
}

var candidates = [];
var seen = {};

function addCand(c) {
  var key = (c.kind || '') + '|' + c.name + '|' + c.lat + '|' + c.lon;
  if (seen[key]) return;
  seen[key] = true;
  var prior = priorByKey[key] || null;
  /* Only reuse priorById when name+coords agree — fish_kml_<index> ids shift as live list changes */
  if (!prior && c.id && priorById[c.id]) {
    var byId = priorById[c.id];
    if (String(byId.name) === String(c.name) &&
        haversineNm(byId.lat, byId.lon, c.lat, c.lon) <= 0.05) prior = byId;
  }
  if (prior && prior.id) c.id = prior.id;
  c.currentlyDisplayed = liveDisplayed(c.kind, c.name, c.lat, c.lon);
  if (prior && prior.verdict && prior.verdict !== 'pending') {
    c.priorVerdict = prior.verdict;
    c.priorNote = prior.note || '';
    c.reviewedAt = prior.reviewedAt || '';
  }
  candidates.push(c);
}

/* 1) Omitted KML — confirm stay out or restore */
for (var oi = 0; oi < omitted.length; oi++) {
  var om = omitted[oi];
  addCand({
    id: 'omit_' + oi,
    kind: 'fish',
    name: om.name,
    lat: om.lat,
    lon: om.lon,
    priority: 'high',
    reason: 'Omitted from map: onshore audit failed (' + om.why + '). Confirm stay omitted, or mark Yes if satellite shows water and we should restore.',
    source: 'San Diego Fishing Spots.kml (user chart)',
    sourceUrl: '',
    sourceDetail: 'Coords verbatim from KML; audit flagged onshore — not nudged.',
    trustClass: 'kml-omitted',
    currentlyDisplayed: false,
    auditWhy: om.why || ''
  });
}

/* 2) KML fish spots — inherent trust; list as low-priority optional spot-check only */
for (var fi = 0; fi < fish.length; fi++) {
  var s = fish[fi];
  if (!s || !s.kmlImported) continue;
  if (s.cdfgAppendix || s.verified) continue;
  var distM = shoreDistM(s.lat, s.lon);
  var nmHome = haversineNm(SLIP.lat, SLIP.lon, s.lat, s.lon);
  var near = distM != null && distM < 750;
  var nameHit = suspectName(s.name);
  var local = nmHome <= 45;
  /* Keep optional list focused: nearshore / shore-ish names / local band only */
  if (!near && !nameHit && !local) continue;
  if (!near && !nameHit && local && nmHome > 25) continue;

  var reasons = [];
  if (near) reasons.push('within ~' + Math.round(distM) + ' m of shoreline model');
  if (nameHit) reasons.push('name suggests pier/beach/harbor/cove/pipe');
  if (local && !near && !nameHit) reasons.push('within 25 NM of King Harbor');

  addCand({
    id: 'fish_kml_' + fi,
    kind: 'fish',
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    priority: 'low',
    reason: 'Inherent KML trust (live with kmlImported) — optional spot-check: ' + reasons.join('; ') + '.',
    source: 'San Diego Fishing Spots.kml (user chart)',
    sourceUrl: '',
    sourceDetail: 'Default-trusted user chart. Coords verbatim. Mark no/unsure only to override live display.',
    trustClass: 'kml-single',
    currentlyDisplayed: true,
    shoreDistM: distM,
    nmFromSlip: Math.round(nmHome * 10) / 10
  });
}

/* 2b) userTrusted fish that are not KML / CDFG / verified — published DMS duals etc.
 * Live-promoted without a review pass; list for optional imagery spot-check.
 * Dedupes against KML rows; prior yes/no/unsure merge by name+coords in addCand. */
for (var fui = 0; fui < fish.length; fui++) {
  var uf = fish[fui];
  if (!uf || !uf.userTrusted) continue;
  if (uf.kmlImported || uf.cdfgAppendix || uf.verified) continue;
  var distUf = shoreDistM(uf.lat, uf.lon);
  var nmUf = haversineNm(SLIP.lat, SLIP.lon, uf.lat, uf.lon);
  addCand({
    id: 'fish_ut_' + fui,
    kind: 'fish',
    name: uf.name,
    lat: uf.lat,
    lon: uf.lon,
    priority: 'medium',
    reason: 'Live with userTrusted (published chart / DMS dual) — optional imagery spot-check. Not KML/CDFG/verified.',
    source: 'FISH_SPOTS userTrusted (live promote)',
    sourceUrl: '',
    sourceDetail: 'Coords verbatim from live list. Mark no/unsure only to override display.',
    trustClass: 'user-trusted-fish',
    currentlyDisplayed: true,
    shoreDistM: distUf,
    nmFromSlip: Math.round(nmUf * 10) / 10
  });
}

/* 3) Non-CDFG dive sites (multi-source verified but worth human eye) */
for (var di = 0; di < dive.length; di++) {
  var d = dive[di];
  if (!d || d.cdfgAppendix) continue;
  if (!d.verified) {
    addCand({
      id: 'dive_' + (d.id || di),
      kind: 'dive',
      name: d.name,
      lat: d.lat,
      lon: d.lon,
      priority: 'high',
      reason: 'Dive site on map without cdfgAppendix flag — confirm water GPS.',
      source: 'dive-engine.js (check verified-water-pins.json)',
      sourceUrl: '',
      sourceDetail: d.verified ? 'marked verified' : 'not verified',
      trustClass: 'dive-unflagged',
      currentlyDisplayed: true,
      diveId: d.id || ''
    });
    continue;
  }
  /* verified non-appendix — lower priority spot-check */
  addCand({
    id: 'dive_ver_' + (d.id || di),
    kind: 'dive',
    name: d.name,
    lat: d.lat,
    lon: d.lon,
    priority: 'low',
    reason: 'Default-trusted multi-source verified dive (verified-water-pins.json). Optional imagery spot-check only.',
    source: 'verified-water-pins.json (multi-source)',
    sourceUrl: '',
    sourceDetail: 'Already live with verified:true; mark no/unsure only to override.',
    trustClass: 'dive-verified',
    currentlyDisplayed: true,
    diveId: d.id || ''
  });
}

/* 4) Extra candidates (e.g. PV single-GPS / hard holds) — not yet live */
if (fileExists('pin-trust-extra-candidates.js')) {
  var extraSrc = readFile('pin-trust-extra-candidates.js')
    .replace(/if\s*\(typeof module[\s\S]*$/, '');
  eval(extraSrc);
  if (typeof PIN_TRUST_EXTRA_CANDIDATES !== 'undefined') {
    for (var ei = 0; ei < PIN_TRUST_EXTRA_CANDIDATES.length; ei++) {
      var ex = PIN_TRUST_EXTRA_CANDIDATES[ei];
      if (!ex || ex.lat == null || ex.lon == null) continue;
      var distEx = shoreDistM(ex.lat, ex.lon);
      var nmEx = haversineNm(SLIP.lat, SLIP.lon, ex.lat, ex.lon);
      addCand({
        id: ex.id || ('extra_' + ei),
        kind: ex.kind || 'dive',
        name: ex.name,
        lat: ex.lat,
        lon: ex.lon,
        priority: ex.priority || 'high',
        reason: ex.reason || 'Extra candidate for imagery trust review.',
        source: ex.source || 'pin-trust-extra-candidates.js',
        sourceUrl: ex.sourceUrl || '',
        sourceDetail: ex.sourceDetail || '',
        trustClass: ex.trustClass || 'extra',
        currentlyDisplayed: !!ex.currentlyDisplayed,
        shoreDistM: distEx,
        nmFromSlip: Math.round(nmEx * 10) / 10
      });
    }
  }
}

/* Keep reviewed no/unsure (and yes extras) in the queue even if omitted from live maps */
if (priorDoc && priorDoc.results) {
  for (var pri = 0; pri < priorDoc.results.length; pri++) {
    var row = priorDoc.results[pri];
    if (!row || !row.id) continue;
    var v = String(row.verdict || '').toLowerCase();
    if (v !== 'no' && v !== 'unsure' && v !== 'yes') continue;
    addCand({
      id: row.id,
      kind: row.kind || 'fish',
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      priority: row.priority || 'high',
      reason: row.reason || ('Prior pin-trust ' + v + ' — kept in queue for re-review.'),
      source: row.source || '',
      sourceUrl: row.sourceUrl || '',
      sourceDetail: v === 'no' || v === 'unsure'
        ? ('Excluded from live maps (' + v + '). Re-review if satellite shows water.')
        : (row.sourceDetail || 'Prior yes — confirm still trusted.'),
      trustClass: row.trustClass || 'prior-review',
      currentlyDisplayed: false
    });
  }
}

/* Sort: high first, then medium, then low; within priority by shoreDist then name */
function priRank(p) { return p === 'high' ? 0 : p === 'medium' ? 1 : 2; }
candidates.sort(function (a, b) {
  var pr = priRank(a.priority) - priRank(b.priority);
  if (pr) return pr;
  var da = a.shoreDistM != null ? a.shoreDistM : 9e9;
  var db = b.shoreDistM != null ? b.shoreDistM : 9e9;
  if (da !== db) return da - db;
  return String(a.name).localeCompare(String(b.name));
});

var high = 0, med = 0, low = 0;
for (var c = 0; c < candidates.length; c++) {
  candidates[c].about = aboutForCandidate(candidates[c]);
  candidates[c].description = candidates[c].about;
  if (candidates[c].priority === 'high') high++;
  else if (candidates[c].priority === 'medium') med++;
  else low++;
}

function isoNow() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + 'Z';
}

var priorResults = [];
if (priorDoc && priorDoc.results) {
  for (var pj = 0; pj < priorDoc.results.length; pj++) {
    var rr = priorDoc.results[pj];
    if (rr && rr.id && rr.verdict && rr.verdict !== 'pending') {
      /* Refresh currentlyDisplayed to match live maps after apply */
      var refreshed = {};
      for (var rk in rr) if (rr.hasOwnProperty(rk)) refreshed[rk] = rr[rk];
      refreshed.currentlyDisplayed = liveDisplayed(rr.kind, rr.name, rr.lat, rr.lon);
      priorResults.push(refreshed);
    }
  }
}

/* Compact live map pins for nearby compare (coords verbatim — never nudged) */
function trustClassOf(s) {
  if (!s) return 'other';
  if (s.cdfgAppendix) return 'cdfg';
  if (s.verified) return 'verified';
  if (s.userTrusted) return 'userTrusted';
  if (s.kmlImported) return 'kml';
  return 'other';
}
var livePins = [];
var liveSeen = {};
function addLive(kind, s, diveId) {
  if (!s || s.lat == null || s.lon == null) return;
  var lk = kind + '|' + s.lat + '|' + s.lon;
  if (liveSeen[lk]) return;
  liveSeen[lk] = true;
  livePins.push({
    kind: kind,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    diveId: diveId || (s.id || ''),
    trustClass: trustClassOf(s),
    currentlyDisplayed: true
  });
}
for (var lfi = 0; lfi < fish.length; lfi++) addLive('fish', fish[lfi], '');
for (var ldi = 0; ldi < dive.length; ldi++) addLive('dive', dive[ldi], dive[ldi] && dive[ldi].id);

/* Explicit feature groups (submodules) — reload into review UI + sync JS for live maps */
var featureGroupsDoc = { type: 'pin-feature-groups', exportedAt: null, groups: [] };
if (fileExists('pin-feature-groups.json')) {
  try {
    var fgt = readFile('pin-feature-groups.json');
    if (fgt.charCodeAt(0) === 0xFEFF) fgt = fgt.substring(1);
    featureGroupsDoc = eval('(' + fgt + ')');
    if (!featureGroupsDoc.groups) featureGroupsDoc.groups = [];
  } catch (eFg) {
    WScript.Echo('Warning: could not parse pin-feature-groups.json — using empty groups');
    featureGroupsDoc = { type: 'pin-feature-groups', exportedAt: null, groups: [] };
  }
}

var payload = {
  generated: isoNow(),
  home: { name: 'King Harbor slip', lat: SLIP.lat, lon: SLIP.lon },
  policy: 'CDFG appendix + San Diego Fishing Spots.kml + verified-water-pins.json are default-trusted on live maps; user no/unsure overrides; no nudges.',
  instructions: 'KML + multi-source verified pins are already live (auto-yes). Mark No/Unsure only to override. Yes restores omitted. Use Nearby + Feature groups for reef modules. Prior answers pre-loaded from pin-trust-review-results.json.',
  counts: { total: candidates.length, high: high, medium: med, low: low, fishTotal: fish.length, diveTotal: dive.length, livePins: livePins.length, featureGroups: (featureGroupsDoc.groups || []).length },
  priorExportedAt: (priorDoc && priorDoc.exportedAt) || null,
  priorSummary: (priorDoc && priorDoc.summary) || null,
  priorResults: priorResults,
  nearbyDefaultNm: 1.0,
  livePins: livePins,
  featureGroups: featureGroupsDoc.groups || [],
  featureGroupsExportedAt: featureGroupsDoc.exportedAt || null,
  candidates: candidates
};

function jsonStringify(v) {
  function ser(o, ind) {
    if (o === null) return 'null';
    var t = typeof o;
    if (t === 'number' || t === 'boolean') return String(o);
    if (t === 'string') return '"' + String(o).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    var sp = '\n' + ind, sp2 = '\n' + ind + '  ';
    if (Object.prototype.toString.call(o) === '[object Array]') {
      if (!o.length) return '[]';
      var a = []; for (var i = 0; i < o.length; i++) a.push(sp2 + ser(o[i], ind + '  '));
      return '[' + a.join(',') + sp + ']';
    }
    var keys = []; for (var k in o) if (o.hasOwnProperty(k)) keys.push(k);
    if (!keys.length) return '{}';
    var p = []; for (var j = 0; j < keys.length; j++) p.push(sp2 + '"' + keys[j] + '": ' + ser(o[keys[j]], ind + '  '));
    return '{' + p.join(',') + sp + '}';
  }
  return ser(v, '');
}

var json = jsonStringify(payload);
writeFile('pin-trust-review-data.js',
  '/* Generated by build-pin-trust-review.js — do not edit by hand */\n' +
  'window.PIN_TRUST_REVIEW = ' + json + ';\n');
writeFile('pin-trust-review.json', json);

/* Keep pin-feature-groups-data.js in sync for dashboard / dive-engine file:// loads */
var fgPayload = {
  type: 'pin-feature-groups',
  exportedAt: featureGroupsDoc.exportedAt || null,
  note: featureGroupsDoc.note || 'Explicit feature groups from pin-trust-review.html. Members keep published coords (never nudged).',
  groups: featureGroupsDoc.groups || []
};
writeFile('pin-feature-groups-data.js',
  '/* Explicit pin feature groups — loaded by dashboard + dive-engine (file:// OK).\n' +
  ' * Synced by build-pin-trust-review.js from pin-feature-groups.json.\n' +
  ' */\n' +
  'window.PIN_FEATURE_GROUPS = ' + jsonStringify(fgPayload) + ';\n');

WScript.Echo('Candidates: ' + candidates.length + ' (high ' + high + ', medium ' + med + ', low ' + low + ')');
WScript.Echo('Live pins for nearby: ' + livePins.length + '; feature groups: ' + (fgPayload.groups || []).length);
WScript.Echo('Wrote pin-trust-review-data.js, pin-trust-review.json, pin-feature-groups-data.js');
WScript.Echo('Open pin-trust-review.html in your browser (file:// OK).');
