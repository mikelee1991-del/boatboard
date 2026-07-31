# Chain OC mainland OSM coastline ways north->south, decimate, emit JS array
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Get-Content (Join-Path $root 'coast-osm.json') -Raw | ConvertFrom-Json

function InMainlandOc($lat, $lon) {
  return ($lat -ge 33.455 -and $lat -le 33.765 -and $lon -ge -118.135 -and $lon -le -117.675)
}
function Key($lat, $lon) { return '{0:F5},{1:F5}' -f $lat, $lon }
function DistM($a, $b) {
  $R=6371000; $p=[Math]::PI/180
  $dl=($b[0]-$a[0])*$p; $do=($b[1]-$a[1])*$p
  $la=$a[0]*$p; $lb=$b[0]*$p
  $h=[Math]::Sin($dl/2)*[Math]::Sin($dl/2)+[Math]::Cos($la)*[Math]::Cos($lb)*[Math]::Sin($do/2)*[Math]::Sin($do/2)
  return 2*$R*[Math]::Asin([Math]::Sqrt($h))
}

$ways = @()
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.geometry) { continue }
  $full = @()
  foreach ($g in $el.geometry) { $full += ,@([double]$g.lat, [double]$g.lon) }
  if ($full.Count -lt 4) { continue }
  $oc = @()
  foreach ($p in $full) { if (InMainlandOc $p[0] $p[1]) { $oc += ,$p } }
  if ($oc.Count -ge 4) {
    $ways += @{ id = $el.id; pts = $oc }
  }
}
Write-Host "Ways: $($ways.Count)"

$anchor = @(33.748, -118.122)
$startWay = -1; $startRev = $false; $bd = 1e9
for ($i=0; $i -lt $ways.Count; $i++) {
  $w = $ways[$i]
  $d0 = DistM $anchor $w.pts[0]; $d1 = DistM $anchor $w.pts[-1]
  if ($d0 -lt $bd) { $bd = $d0; $startWay = $i; $startRev = $false }
  if ($d1 -lt $bd) { $bd = $d1; $startWay = $i; $startRev = $true }
}
Write-Host ("Start way {0} rev={1} dist={2:F0}m" -f $ways[$startWay].id, $startRev, $bd)

$used = @{}
$ordered = New-Object System.Collections.Generic.List[object]
$pts = $ways[$startWay].pts
if ($startRev) { $pts = $pts.Clone(); [array]::Reverse($pts) }
$used[$startWay] = $true
foreach ($p in $pts) { $ordered.Add(@{ lat = $p[0]; lon = $p[1] }) }

for ($step=0; $step -lt 300; $step++) {
  $tail = $ordered[$ordered.Count-1]
  $best = -1; $bestRev = $false; $bd = 2000.0
  for ($i=0; $i -lt $ways.Count; $i++) {
    if ($used.ContainsKey($i)) { continue }
    $w = $ways[$i]
    $d0 = DistM @($tail.lat,$tail.lon) $w.pts[0]
    $d1 = DistM @($tail.lat,$tail.lon) $w.pts[-1]
    if ($d0 -lt $bd) { $bd = $d0; $best = $i; $bestRev = $false }
    if ($d1 -lt $bd) { $bd = $d1; $best = $i; $bestRev = $true }
  }
  if ($best -lt 0) { break }
  $used[$best] = $true
  $pts = $ways[$best].pts
  if ($bestRev) { $pts = $pts.Clone(); [array]::Reverse($pts) }
  $startIdx = 0
  if ((DistM @($tail.lat,$tail.lon) $pts[0]) -lt 15) { $startIdx = 1 }
  for ($j=$startIdx; $j -lt $pts.Count; $j++) {
    $ordered.Add(@{ lat = $pts[$j][0]; lon = $pts[$j][1] })
  }
}
Write-Host ("Chained pts: $($ordered.Count) ways used: $($used.Count)")

$dec = New-Object System.Collections.Generic.List[object]
$dec.Add($ordered[0])
for ($i=1; $i -lt $ordered.Count; $i++) {
  $a = $dec[$dec.Count-1]; $b = $ordered[$i]
  if ((DistM @($a.lat,$a.lon) @($b.lat,$b.lon)) -ge 250) { $dec.Add($b) }
}
$last = $ordered[$ordered.Count-1]
$a = $dec[$dec.Count-1]
if ((Key $a.lat $a.lon) -ne (Key $last.lat $last.lon)) { $dec.Add($last) }
Write-Host ("Decimated to $($dec.Count) pts")
Write-Host ("First: {0:F5},{1:F5} Last: {2:F5},{3:F5}" -f $dec[0].lat,$dec[0].lon,$dec[-1].lat,$dec[-1].lon)

$lines = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $dec.Count; $i++) {
  $p = $dec[$i]
  $lines.Add("  { lat: $($p.lat.ToString('F5')), lon: $($p.lon.ToString('F5')) }")
}
("var OC_GAP_FILL = [`n" + ($lines -join ",`n") + "`n];") | Set-Content (Join-Path $root 'oc-gap-fill.js.txt') -Encoding UTF8
Write-Host "Wrote oc-gap-fill.js.txt"
