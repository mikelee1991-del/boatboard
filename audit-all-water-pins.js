// Run fish + dive onshore scans — cscript //Nologo audit-all-water-pins.js
// Map-aligned audit is advisory only (overfires on seaward-normal / segment matching).
var shell = new ActiveXObject('WScript.Shell');
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var cscript = 'cscript.exe //Nologo ';
var fail = false;

function run(name, hardGate) {
  WScript.Echo('');
  WScript.Echo('========== ' + name + (hardGate ? '' : ' (advisory)') + ' ==========');
  var ec = shell.Run(cscript + '"' + root + '\\' + name + '"', 0, true);
  if (hardGate && ec !== 0) fail = true;
  if (!hardGate && ec !== 0) {
    WScript.Echo('NOTE: ' + name + ' reported failures (advisory — not a hard gate).');
  }
  return ec;
}

run('scan-fish-onshore.js', true);
run('scan-dive-onshore.js', true);
run('audit-map-water-pins.js', false);

WScript.Echo('');
if (fail) {
  WScript.Echo('FAIL: fish and/or dive onshore scan failed (hard gates).');
  WScript.Quit(1);
}
WScript.Echo('OK: hard gates passed (fish + dive onshore). Map audit is advisory only.');
