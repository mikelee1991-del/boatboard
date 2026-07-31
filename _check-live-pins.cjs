var fs = require('fs');
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
  return eval('[' + src.substring(start, i - 1) + ']');
}
var label = process.argv[2] || 'LIVE';
var html = fs.readFileSync('index.html', 'utf8');
var dive = fs.readFileSync('dive-engine.js', 'utf8');
var fish = extractArray(html, 'FISH_SPOTS') || [];
var sites = extractArray(dive, 'DIVE_SITES') || [];
console.log(label, 'fish', fish.length, 'dive', sites.length);
var names = [
  'Ocean Trails', 'Portuguese Bend', 'Sacred Cove', 'Goat Harbor',
  'Mission Bay Jetty', 'Oceanside Harbor', 'Venice Pier Reef', 'Barn Kelp',
  'Biodome', 'Module 2A', 'Pt. Fermin Kelp', 'Portuguese Kelp',
  "Doctor's Cove", 'Lulu Reef', 'Nooks and Crannies', 'Yellowtail Point',
  'Eagle Rock — Catalina West', 'Monarch Boiler', 'Orange Rocks'
];
names.forEach(function (n) {
  var f = fish.filter(function (s) { return String(s.name).indexOf(n) >= 0; })
    .map(function (s) { return 'F:' + s.name + '@' + s.lat; });
  var d = sites.filter(function (s) { return String(s.name).indexOf(n) >= 0; })
    .map(function (s) {
      return 'D:' + s.name + (s.id ? '(' + s.id + ')' : '') + '@' + s.lat + (s.verified ? ' V' : '');
    });
  if (f.length || d.length) console.log(n, '=>', f.concat(d).join(' | '));
  else console.log(n, '=> ABSENT');
});
