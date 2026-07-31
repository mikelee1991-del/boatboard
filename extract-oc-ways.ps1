# Extract and concatenate specific OSM mainland OC ways north->south
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
function OrientWay($pts, $from, $to) {
  $dStart = DistM $from $pts[0]; $dEnd = DistM $from $pts[-1]
  if ($dEnd -lt $dStart) { $p = $pts.Clone(); [array]::Reverse($p); return $p }
  return $pts
}
function AppendWay($ordered, $pts) {
  if ($ordered.Count -eq 0) { foreach ($p in $pts) { $ordered.Add(@{ lat=$p[0]; lon=$p[1] }) }; return }
  $tail = $ordered[$ordered.Count-1]
  $si = 0
  if ((DistM @($tail.lat,$tail.lon) $pts[0]) -lt 30) { $si = 1 }
  for ($j=$si; $j -lt $pts.Count; $j++) {
    $ordered.Add(@{ lat = $pts[$j][0]; lon = $pts[$j][1] })
  }
}

# Main open-coast way IDs (north -> south), from OSM survey
$wayIds = @(
  30149154, 41645269, 41645434, 41645370,
  41645359, 41645366, 41645368, 40501084
)

$ordered = New-Object System.Collections.Generic.List[object]
$prev = @(33.748, -118.122)
foreach ($wid in $wayIds) {
  $pts = GetWay $wid
  if (-not $pts) { Write-Host "Missing way $wid"; continue }
  if ($ordered.Count -eq 0) {
    $pts = OrientWay $pts $prev @(33.46, -117.72)
  } else {
    $tail = $ordered[$ordered.Count-1]
    $d0 = DistM @($tail.lat,$tail.lon) $pts[0]
    $d1 = DistM @($tail.lat,$tail.lon) $pts[-1]
    if ($d1 -lt $d0) { $pts = $pts.Clone(); [array]::Reverse($pts) }
  }
  AppendWay $ordered $pts
  Write-Host ("way $wid -> total $($ordered.Count) pts end {0:F5},{1:F5}" -f $ordered[-1].lat,$ordered[-1].lon)
}

# Add more south ways if needed - find ways with start lat < 33.55 and end > 33.46
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.geometry) { continue }
  if ($wayIds -contains $el.id) { continue }
  $pts = @(); foreach ($g in $el.geometry) { $pts += ,@([double]$g.lat, [double]$g.lon) }
  if ($pts[-1][0] -gt 33.52 -or $pts[0][0] -gt 33.52) { continue }
  if ($pts[-1][0] -lt 33.45 -and $pts[0][0] -lt 33.45) { continue }
  if ($pts[0][1] -lt -118.15 -or $pts[-1][1] -lt -118.15) { continue }
  $tail = $ordered[-1]
  $d0 = DistM @($tail.lat,$tail.lon) $pts[0]; $d1 = DistM @($tail.lat,$tail.lon) $pts[-1]
  if ([Math]::Min($d0,$d1) -gt 2000) { continue }
  if ($d1 -lt $d0) { $pts = $pts.Clone(); [array]::Reverse($pts) }
  Write-Host ("Append south way $($el.id) ($($pts.Count) pts)")
  AppendWay $ordered $pts
}

Write-Host "Total $($ordered.Count) pts"

# Decimate 250m, cap max jump 800m between kept points
$dec = New-Object System.Collections.Generic.List[object]
$dec.Add($ordered[0])
for ($i=1; $i -lt $ordered.Count; $i++) {
  $a = $dec[$dec.Count-1]; $b = $ordered[$i]
  $d = DistM @($a.lat,$a.lon) @($b.lat,$b.lon)
  if ($d -ge 250 -and $d -le 800) { $dec.Add($b) }
  elseif ($d -ge 250) {
    # long jump - insert midpoint
    $mid = @{ lat = ($a.lat+$b.lat)/2; lon = ($a.lon+$b.lon)/2 }
    $dec.Add($mid); $dec.Add($b)
  }
}
$last = $ordered[-1]
if ("{0:F5},{1:F5}" -f $dec[-1].lat,$dec[-1].lon -ne "{0:F5},{1:F5}" -f $last.lat,$last.lon) { $dec.Add($last) }

Write-Host "Decimated $($dec.Count) pts"
Write-Host ("First: {0:F5},{1:F5} Last: {2:F5},{3:F5}" -f $dec[0].lat,$dec[0].lon,$dec[-1].lat,$dec[-1].lon)

$lines = @()
foreach ($p in $dec) { $lines += "  { lat: $($p.lat.ToString('F5')), lon: $($p.lon.ToString('F5')) }" }
("var OC_GAP_FILL = [`n" + ($lines -join ",`n") + "`n];") | Set-Content (Join-Path $root 'oc-gap-fill.js.txt') -Encoding UTF8

$refs = @(
  @{ n='Seal Beach'; lat=33.741; lon=-118.104 },
  @{ n='HB pier'; lat=33.655; lon=-118.004 },
  @{ n='Newport'; lat=33.609; lon=-117.929 },
  @{ n='Laguna'; lat=33.542; lon=-117.789 },
  @{ n='Dana Point'; lat=33.462; lon=-117.716 }
)
foreach ($r in $refs) {
  $bd = 1e9
  foreach ($p in $dec) {
    $d = DistM @($r.lat,$r.lon) @($p.lat,$p.lon)
    if ($d -lt $bd) { $bd = $d }
  }
  Write-Host ("{0}: {1:F0}m ({2:F2} NM)" -f $r.n, $bd, ($bd/1852))
}
