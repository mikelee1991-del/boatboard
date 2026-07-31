# Extract Malibu / Santa Monica coast — explicit OSM way chain south -> north
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Get-Content (Join-Path $root 'coast-osm.json') -Raw | ConvertFrom-Json

function DistM($a, $b) {
  $R=6371000; $p=[Math]::PI/180
  $dl=($b[0]-$a[0])*$p; $do=($b[1]-$a[1])*$p
  $la=$a[0]*$p; $lb=$b[0]*$p
  $h=[Math]::Sin($dl/2)*[Math]::Sin($dl/2)+[Math]::Cos($la)*[Math]::Cos($lb)*[Math]::Sin($do/2)*[Math]::Sin($do/2)
  return 2*$R*[Math]::Asin([Math]::Sqrt($h))
}
function GetWay($id) {
  foreach ($el in $raw.elements) {
    if ($el.type -eq 'way' -and [long]$el.id -eq [long]$id) {
      $pts = @()
      foreach ($g in $el.geometry) { $pts += ,@([double]$g.lat, [double]$g.lon) }
      return $pts
    }
  }
  return $null
}
function AppendWay($ordered, $pts) {
  if ($ordered.Count -eq 0) { foreach ($p in $pts) { $ordered.Add(@{ lat=$p[0]; lon=$p[1] }) }; return }
  $tail = $ordered[$ordered.Count-1]
  $si = 0
  if ((DistM @($tail.lat,$tail.lon) $pts[0]) -lt 35) { $si = 1 }
  for ($j=$si; $j -lt $pts.Count; $j++) { $ordered.Add(@{ lat = $pts[$j][0]; lon = $pts[$j][1] }) }
}

$anchor = @(33.947, -118.446)
$goal = @(34.096, -119.000)

$wayIds = @(
  443088222, 592262540, 443668554, 614584879,
  1081304239, 1082415740, 1082415739, 1082435153, 1082446360,
  1082435160, 1082435167, 1082435168, 1082439256, 1082439255,
  1082439261, 1082439262, 1082439267, 1082439268, 1082454761,
  481422966, 413548141, 4883641, 4883746, 481422973,
  481422971, 481422972, 1082532220, 1082532219, 481422981,
  828997545, 399506122, 4883353, 4883720, 763471829
)

$ordered = New-Object System.Collections.Generic.List[object]
$ordered.Add(@{ lat = $anchor[0]; lon = $anchor[1] })

foreach ($wid in $wayIds) {
  $pts = GetWay $wid
  if (-not $pts) { Write-Host "Missing way $wid"; continue }
  $tail = $ordered[$ordered.Count-1]
  $d0 = DistM @($tail.lat,$tail.lon) $pts[0]
  $d1 = DistM @($tail.lat,$tail.lon) $pts[-1]
  if ([Math]::Min($d0,$d1) -gt 4000) {
    Write-Host ("WARN gap way $wid minDist={0:F0}m" -f [Math]::Min($d0,$d1))
  }
  if ($d1 -lt $d0) { $pts = $pts.Clone(); [array]::Reverse($pts) }
  AppendWay $ordered $pts
  Write-Host ("way $wid -> $($ordered.Count) end {0:F5},{1:F5}" -f $ordered[-1].lat,$ordered[-1].lon)
}

Write-Host ("Total $($ordered.Count) First->Last: {0:F5},{1:F5} -> {2:F5},{3:F5}" -f $ordered[0].lat,$ordered[0].lon,$ordered[-1].lat,$ordered[-1].lon)

$dec = New-Object System.Collections.Generic.List[object]
$dec.Add($ordered[0])
for ($i=1; $i -lt $ordered.Count; $i++) {
  $a = $dec[$dec.Count-1]; $b = $ordered[$i]
  if ((DistM @($a.lat,$a.lon) @($b.lat,$b.lon)) -ge 250) { $dec.Add($b) }
}
$last = $ordered[-1]
if ("{0:F5},{1:F5}" -f $dec[-1].lat,$dec[-1].lon -ne "{0:F5},{1:F5}" -f $last.lat,$last.lon) { $dec.Add($last) }
Write-Host "Decimated $($dec.Count) pts goalDist=$([int](DistM @($dec[-1].lat,$dec[-1].lon) $goal))m"

$lines = @()
foreach ($p in $dec) { $lines += "  { lat: $($p.lat.ToString('F5')), lon: $($p.lon.ToString('F5')) }" }
$out = "var MALIBU_GAP_FILL = [`n" + ($lines -join ",`n") + "`n];"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $root 'malibu-gap-fill.js.txt'), $out, $utf8)

$refs = @(
  @{ n='El Segundo'; lat=33.915; lon=-118.435 },
  @{ n='Santa Monica Pier'; lat=34.010; lon=-118.497 },
  @{ n='Malibu Pier'; lat=34.035; lon=-118.678 },
  @{ n='Point Dume'; lat=34.001; lon=-118.806 }
)
foreach ($r in $refs) {
  $bd = 1e9
  foreach ($p in $dec) {
    $d = DistM @($r.lat,$r.lon) @($p.lat,$p.lon)
    if ($d -lt $bd) { $bd = $d }
  }
  Write-Host ("{0}: {1:F0}m ({2:F2} NM)" -f $r.n, $bd, ($bd/1852))
}
