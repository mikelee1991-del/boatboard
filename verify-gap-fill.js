var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
var G = {};
eval(fso.OpenTextFile(root + '\\coast-overlay-lite.js', 1).ReadAll().replace(/window\.COAST_OVERLAY_LITE/g, 'G'));
var NM=1852;
function hav(a,b){var R=6371000,d2r=Math.PI/180,dlat=(b.lat-a.lat)*d2r,dlon=(b.lon-a.lon)*d2r,la=a.lat*d2r,lb=b.lat*d2r,h=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(la)*Math.cos(lb)*Math.sin(dlon/2)*Math.sin(dlon/2);return 2*R*Math.asin(Math.sqrt(h));}
var REFS=[{n:'Seal Beach',lat:33.741,lon:-118.104},{n:'HB pier',lat:33.655,lon:-118.004}];
for (var li=0;li<G.lines.length;li++){
  if (G.lines[li].name !== 'coast-other-2-1') continue;
  var worst=0, wp=null, j, p, r, best;
  for (j=0;j<G.lines[li].pts.length;j++){
    p=G.lines[li].pts[j]; best=1e12;
    for(r=0;r<REFS.length;r++){var o=hav(p,REFS[r]); if(o<best) best=o;}
    if(best>worst){worst=best; wp=p;}
  }
  WScript.Echo('gap-fill worst nearest pier: '+(worst/NM).toFixed(2)+' NM at '+wp.lat+','+wp.lon);
}
