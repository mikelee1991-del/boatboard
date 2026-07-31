/**
 * Legacy omit script — DISABLED under inherent KML trust policy.
 * San Diego Fishing Spots.kml placemarks stay on live maps with verbatim coords.
 * User no/unsure overrides are applied by apply-pin-trust-yes.js (pin-trust-live-exclusions.json).
 * Usage: cscript //Nologo omit-kml-onshore-fish.js
 */
var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
function writeFile(n, c) { var f = fso.CreateTextFile(root + '\\' + n, true); f.Write(c); f.Close(); }

writeFile('kml-onshore-omitted.json',
  '{"note":"omit-kml-onshore-fish.js is a no-op: San Diego Fishing Spots.kml is inherently trusted (same tier as cdfgAppendix). Use pin-trust no/unsure to exclude specific pins.","count":0,"omitted":[]}');

WScript.Echo('omit-kml-onshore-fish.js: no-op (inherent KML trust). Nothing omitted.');
