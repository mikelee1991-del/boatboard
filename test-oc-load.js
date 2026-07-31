var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function readFile(n) { return fso.OpenTextFile(root + '\\' + n, 1).ReadAll(); }
function loadGapFill(n) {
  var txt = readFile(n);
  WScript.Echo('char0=' + txt.charCodeAt(0));
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.substring(1);
  var body = txt.replace(/^var \w+ = /, '');
  WScript.Echo('body start: ' + body.substring(0, 30));
  try {
    return eval(body);
  } catch (e) {
    WScript.Echo('ERR ' + e.message);
    return [];
  }
}
var oc = loadGapFill('oc-gap-fill.js.txt');
WScript.Echo('OC count=' + oc.length);
var mb = loadGapFill('malibu-gap-fill.js.txt');
WScript.Echo('MALIBU count=' + mb.length);
