/* Verify fish feature grouping. Usage: cscript //Nologo verify-fish-feature-groups.js */
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var src = fso.OpenTextFile(root + '\\index.html', 1).ReadAll();
var start = src.indexOf('const FISH_SPOTS = [');
var end = src.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('FISH_SPOTS not found');
/* Array literal ends at first top-level ]; after const — HTML may have other ]; later; bound by assignFishFeatureGroups. */
var assignAt = src.indexOf('assignFishFeatureGroups();', start);
if (assignAt < 0) throw new Error('assignFishFeatureGroups not found');
end = src.lastIndexOf('\n];', assignAt);
if (end < 0 || end < start) throw new Error('FISH_SPOTS closing ]; not found');
var FISH_SPOTS = eval(src.substring(start + 'const FISH_SPOTS = '.length, end + 4));
var NM_R = 3440.065;
var FEATURE_GROUP_NM = 1.0;
var NM_M = 1852;

function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

function haversineNm(lat1, lon1, lat2, lon2) {
  var p = Math.PI / 180;
  var dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * NM_R * Math.asin(Math.sqrt(a));
}

function stripFeatureSuffixes(name) {
  var s = trimStr(String(name || ''));
  var afterDash = s.match(/[\u2013\u2014\-]\s*(.+\b(?:Artificial\s+)?Reef\b.*)$/i);
  if (afterDash) s = afterDash[1];
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(module|unit|section|block|mod)\s*[#.]?\s*[a-z0-9]+\b/gi, ' ');
  s = s.replace(/\bcenter\b/gi, ' ');
  var keptComplex = false;
  s = s.replace(/\b((?:artificial\s+)?reef)\s+(\d+)\s+[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*\s*$/i, function (_, reef, num) {
    keptComplex = true;
    return reef + ' ' + num;
  });
  s = s.replace(/\b((?:artificial\s+)?reef)\s+(?:\d+[A-Za-z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*)\s*$/i, '$1');
  if (!keptComplex) s = s.replace(/\b((?:artificial\s+)?reef)\s+\d+\s*$/i, '$1');
  return trimStr(s.replace(/\s+/g, ' '));
}

function featureBaseKey(name) {
  return trimStr(stripFeatureSuffixes(name).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bbay\s+(?=artificial\s+reef\b)/g, ''));
}

function featureDisplayName(name) {
  return stripFeatureSuffixes(name) || trimStr(String(name || ''));
}

function assignFeatureGroups(sites) {
  var n = sites.length;
  var parent = [];
  var i, j, a, b, ia, ib, r, k, cand;
  for (i = 0; i < n; i++) parent[i] = i;
  function find(ix) { return parent[ix] === ix ? ix : (parent[ix] = find(parent[ix])); }
  function union(x, y) { parent[find(x)] = find(y); }
  var keys = [];
  var labels = [];
  for (i = 0; i < n; i++) {
    keys.push(featureBaseKey(sites[i].name));
    labels.push(featureDisplayName(sites[i].name));
  }
  var byKey = {};
  for (i = 0; i < n; i++) {
    k = keys[i] || ('__idx_' + i);
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(i);
  }
  for (k in byKey) {
    if (!byKey.hasOwnProperty(k)) continue;
    var idxs = byKey[k];
    if (idxs.length < 2) continue;
    for (a = 0; a < idxs.length; a++) {
      for (b = a + 1; b < idxs.length; b++) {
        ia = idxs[a]; ib = idxs[b];
        if (haversineNm(sites[ia].lat, sites[ia].lon, sites[ib].lat, sites[ib].lon) <= FEATURE_GROUP_NM) {
          union(ia, ib);
        }
      }
    }
  }
  var members = {};
  for (i = 0; i < n; i++) {
    r = find(i);
    if (!members[r]) members[r] = [];
    members[r].push(i);
  }
  var roots = [];
  for (r in members) if (members.hasOwnProperty(r)) roots.push(r);
  for (var gi = 0; gi < roots.length; gi++) {
    idxs = members[roots[gi]];
    var groupId = 'ffg_' + gi;
    var groupName = labels[idxs[0]] || sites[idxs[0]].name;
    for (j = 1; j < idxs.length; j++) {
      cand = labels[idxs[j]] || sites[idxs[j]].name;
      if (cand.length < groupName.length) groupName = cand;
    }
    for (j = 0; j < idxs.length; j++) {
      sites[idxs[j]].featureGroup = groupId;
      sites[idxs[j]].featureGroupName = groupName;
      sites[idxs[j]].featureGroupSize = idxs.length;
    }
  }
  return roots.length;
}

var groupCount = assignFeatureGroups(FISH_SPOTS);
var cdfgPins = 0, cdfgGroupMap = {}, i;
for (i = 0; i < FISH_SPOTS.length; i++) {
  if (FISH_SPOTS[i].cdfgAppendix) {
    cdfgPins++;
    cdfgGroupMap[FISH_SPOTS[i].featureGroup] = 1;
  }
}
var cdfgGroups = 0;
for (i in cdfgGroupMap) if (cdfgGroupMap.hasOwnProperty(i)) cdfgGroups++;

var LAT = 33.86, LON = -118.40, FIT = 55;
var pinsLocal = 0, groupsLocalMap = {};
for (i = 0; i < FISH_SPOTS.length; i++) {
  var s = FISH_SPOTS[i];
  if (haversineNm(LAT, LON, s.lat, s.lon) <= FIT) {
    pinsLocal++;
    groupsLocalMap[s.featureGroup] = 1;
  }
}
var groupsLocal = 0;
for (i in groupsLocalMap) if (groupsLocalMap.hasOwnProperty(i)) groupsLocal++;

var multiNames = {};
for (i = 0; i < FISH_SPOTS.length; i++) {
  s = FISH_SPOTS[i];
  if (s.featureGroupSize > 1) {
    multiNames[s.featureGroup] = s.featureGroupName + ' (' + s.featureGroupSize + ')';
  }
}
var multiList = [];
for (i in multiNames) if (multiNames.hasOwnProperty(i)) multiList.push(multiNames[i]);
multiList.sort();

function groupOf(substr) {
  for (var x = 0; x < FISH_SPOTS.length; x++) {
    if (FISH_SPOTS[x].name.indexOf(substr) >= 0) {
      return FISH_SPOTS[x].featureGroupName + ' #' + FISH_SPOTS[x].featureGroup + ' n=' + FISH_SPOTS[x].featureGroupSize;
    }
  }
  return 'MISSING';
}

WScript.Echo('=== Fish feature grouping verify ===');
WScript.Echo('Raw pins: ' + FISH_SPOTS.length);
WScript.Echo('Feature groups: ' + groupCount);
WScript.Echo('CDFG pins: ' + cdfgPins + ' -> groups: ' + cdfgGroups);
WScript.Echo('Hermosa/Redondo (~33.86,-118.40) within ' + FIT + ' nm:');
WScript.Echo('  pins: ' + pinsLocal + ' -> groups: ' + groupsLocal);
WScript.Echo('Heuristic: name normalize (Module/Unit/Section/Block/Center + letter/number) + union-find <= ' + FEATURE_GROUP_NM + ' nm');
WScript.Echo('Multi-module groups (' + multiList.length + '):');
for (i = 0; i < multiList.length; i++) WScript.Echo('  - ' + multiList[i]);
WScript.Echo('Hermosa A -> ' + groupOf('Hermosa Beach Artificial Reef A'));
WScript.Echo('Redondo A -> ' + groupOf('Redondo Beach Artificial Reef A'));
WScript.Echo('Barge 287 -> ' + groupOf('Barge 287'));
WScript.Echo('Santa Monica Bay -> ' + groupOf('Santa Monica Bay Artificial Reef 17'));
WScript.Echo('Santa Monica AR A -> ' + groupOf('Santa Monica Artificial Reef A'));
WScript.Echo('Palawan -> ' + groupOf('Palawan'));
