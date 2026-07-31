var fs = require('fs');
var path = 'C:/Users/mikel/.cursor/projects/c-Users-mikel-Downloads-NewRepo/agent-transcripts/3bb81e72-0c2e-4b19-aa7e-e3397193fe58/3bb81e72-0c2e-4b19-aa7e-e3397193fe58.jsonl';
var TARGET = '2026-07-29T06:20:42.367Z';
var lines = fs.readFileSync(path, 'utf8').split('\n');
var n = 0;
var found = null;
for (var i = 0; i < lines.length; i++) {
  if (!lines[i] || lines[i].indexOf(TARGET) < 0) continue;
  n++;
  console.log('hit line', i, 'len', lines[i].length);
  try {
    var obj = JSON.parse(lines[i]);
    var role = obj.role || (obj.message && obj.message.role);
    console.log('  role', role);
    var content = (obj.message && obj.message.content) || obj.content;
    var text = null;
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) {
      for (var c = 0; c < content.length; c++) {
        if (content[c] && content[c].text && content[c].text.indexOf(TARGET) >= 0) {
          text = content[c].text;
          break;
        }
        if (content[c] && content[c].type === 'text' && content[c].text) text = content[c].text;
      }
    }
    if (!text) {
      console.log('  no text');
      continue;
    }
    console.log('  text has json fence', text.indexOf('```json') >= 0, 'len', text.length);
    var start = text.indexOf('```json');
    if (start < 0) continue;
    var end = text.indexOf('```', start + 7);
    if (end < 0) continue;
    var raw = text.slice(start + 7, end).trim();
    var doc = JSON.parse(raw);
    console.log('  parsed exportedAt', doc.exportedAt, 'results', (doc.results || []).length);
    if (doc.exportedAt === TARGET) found = doc;
  } catch (e) {
    console.log('  err', e.message);
  }
}
console.log('total hits', n);
if (!found) {
  console.error('Export not found');
  process.exit(1);
}
fs.writeFileSync(__dirname + '/_tmp-export-raw.json', JSON.stringify(found, null, 2));
var byV = {};
found.results.forEach(function (r) { byV[r.verdict] = (byV[r.verdict] || 0) + 1; });
console.log('WROTE', found.exportedAt, JSON.stringify(byV));
