var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(WScript.ScriptFullName);
eval(fso.OpenTextFile(root + '\\oc-gap-fill.js.txt', 1).ReadAll().replace(/var OC_GAP_FILL/g, 'var G').replace('];', ']; OC_GAP_FILL=G;'));
var NM=1852;
function hav(a,b){var R=6371000,d2r=Math.PI/180,dlat=(b.lat-a.lat)*d2r,dlon=(b.lon-a.lon)*d2r,la=a.lat*d2r,lb=b.lat*d2r,h=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(la)*Math.cos(lb)*Math.sin(dlon/2)*Math.sin(dlon/2);return 2*R*Math.asin(Math.sqrt(h));}
var REFS=[
  {n:'Seal Beach',lat:33.741,lon:-118.104},
  {n:'HB pier',lat:33.655,lon:-118.004},
  {n:'Newport',lat:33.609,lon:-117.929},
  {n:'Laguna',lat:33.542,lon:-117.789},
  {n:'Dana Point',lat:33.462,lon:-117.716}
];
for (var ri=0;ri<REFS.length;ri++){
  var best=1e12,bp=null;
  for (var i=0;i<OC_GAP_FILL.length;i++){
    var d=hav(OC_GAP_FILL[i],REFS[ri]);
    if(d<best){best=d;bp=OC_GAP_FILL[i];}
  }
  WScript.Echo(REFS[ri].n+': '+(best/NM).toFixed(3)+' NM at '+bp.lat+','+bp.lon);
}
WScript.Echo('OC_GAP_FILL count='+OC_GAP_FILL.length);
// Huntington lat ~33.655 - show lon of nearest fill point
var hbLat=33.655,bestI=0,bestD=999;
for (i=0;i<OC_GAP_FILL.length;i++){
  var d=Math.abs(OC_GAP_FILL[i].lat-hbLat);
  if(d<bestD){bestD=d;bestI=i;}
}
WScript.Echo('At HB lat: '+OC_GAP_FILL[bestI].lat+','+OC_GAP_FILL[bestI].lon);
// Max chord in source (before subdivide)
var maxM=0;
for (i=1;i<OC_GAP_FILL.length;i++){
  var dm=hav(OC_GAP_FILL[i-1],OC_GAP_FILL[i]);
  if(dm>maxM) maxM=dm;
}
WScript.Echo('Max source segment: '+(maxM/NM).toFixed(3)+' NM ('+maxM.toFixed(0)+'m)');
