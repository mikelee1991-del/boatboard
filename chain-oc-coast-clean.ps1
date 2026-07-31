# Clean OC open-coast trace: filter harbor ways, chain, trim Seal Beach -> Dana Point
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
function OpenCoastPt($lat, $lon) {
  if ($lat -lt 33.458 -or $lat -gt 33.752) { return $false }
  if ($lon -lt -118.135 -or $lon -gt -117.675) { return $false }
  # Exclude mid-channel phantom box (west of beaches)
  if ($lat -ge 33.64 -and $lat -le 33.735 -and $lon -ge -118.185 -and $lon -lt -118.115) { return $false }
  return $true
}

$ways = @()
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.geometry) { continue }
  if ($el.tags.place -eq 'island') { continue }
  if ($el.tags.name -match 'Island') { continue }
  $full = @()
  foreach ($g in $el.geometry) { $full += ,@([double]$g.lat, [double]$g.lon) }
  $oc = @($full | Where-Object { OpenCoastPt $_[0] $_[1] })
  if ($oc.Count -ge 6) { $ways += ,@($el.id, $oc) }
}
Write-Host "Filtered ways: $($ways.Count)"

$anchor = @(33.741, -118.104)  # Seal Beach pier
$endGoal = @(33.462, -117.716) # Dana Point harbor

# Start from way nearest Seal Beach
$startIdx = -1; $startRev = $false; $bd = 1e9
for ($i=0; $i -lt $ways.Count; $i++) {
  $w = $ways[$i][1]
  $d0 = DistM $anchor $w[0]; $d1 = DistM $anchor $w[-1]
  if ($d0 -lt $bd) { $bd = $d0; $startIdx = $i; $startRev = $false }
  if ($d1 -lt $bd) { $bd = $d1; $startIdx = $i; $startRev = $true }
}
Write-Host ("Start way $($ways[$startIdx][0]) dist={0:F0}m" -f $bd)

$used = @{}; $ordered = New-Object System.Collections.Generic.List[object]
$pts = $ways[$startIdx][1]
if ($startRev) { $pts = $pts.Clone(); [array]::Reverse($pts) }
$used[$startIdx] = $true
foreach ($p in $pts) { $ordered.Add(@{ lat = $p[0]; lon = $p[1] }) }

for ($step=0; $step -lt 400; $step++) {
  $tail = $ordered[$ordered.Count-1]
  if ((DistM @($tail.lat,$tail.lon) $endGoal) -lt 400) { break }
  $best = -1; $bestRev = $false; $bd = 1500.0
  for ($i=0; $i -lt $ways.Count; $i++) {
    if ($used.ContainsKey($i)) { continue }
    $w = $ways[$i][1]
    $d0 = DistM @($tail.lat,$tail.lon) $w[0]
    $d1 = DistM @($tail.lat,$tail.lon) $w[-1]
    if ($d0 -lt $bd) { $bd = $d0; $best = $i; $bestRev = $false }
    if ($d1 -lt $bd) { $bd = $d1; $best = $i; $bestRev = $true }
  }
  if ($best -lt 0) { break }
  $used[$best] = $true
  $pts = $ways[$best][1]
  if ($bestRev) { $pts = $pts.Clone(); [array]::Reverse($pts) }
  $si = 0
  if ((DistM @($tail.lat,$tail.lon) $pts[0]) -lt 20) { $si = 1 }
  foreach ($p in $pts[$si..($pts.Count-1)]) {
    $ordered.Add(@{ lat = $p[0]; lon = $p[1] })
  }
}
Write-Host ("Chained $($ordered.Count) pts, $($used.Count) ways")

# Trim: keep points from first near Seal Beach to first near Dana (no harbor extension)
$si = 0; $bd = 1e9
for ($i=0; $i -lt $ordered.Count; $i++) {
  $d = DistM $anchor @($ordered[$i].lat, $ordered[$i].lon)
  if ($d -lt $bd) { $bd = $d; $si = $i }
}
$ei = $ordered.Count - 1; $bd = 1e9
for ($i=$si; $i -lt $ordered.Count; $i++) {
  $d = DistM $endGoal @($ordered[$i].lat, $ordered[$i].lon)
  if ($d -lt $bd) { $bd = $d; $ei = $i }
}
if ($ei -le $si) { $ei = $ordered.Count - 1 }
$trim = $ordered[$si..$ei]
Write-Host ("Trimmed $($trim.Count) pts (idx $si..$ei)")

# Decimate ~300m
$dec = New-Object System.Collections.Generic.List[object]
$dec.Add($trim[0])
for ($i=1; $i -lt $trim.Count; $i++) {
  $a = $dec[$dec.Count-1]; $b = $trim[$i]
  if ((DistM @($a.lat,$a.lon) @($b.lat,$b.lon)) -ge 280) { $dec.Add($b) }
}
$last = $trim[-1]
$a = $dec[-1]
if ("{0:F5},{1:F5}" -f $a.lat,$a.lon -ne "{0:F5},{1:F5}" -f $last.lat,$last.lon) { $dec.Add($last) }
Write-Host ("Decimated $($dec.Count) pts")
Write-Host ("First: {0:F5},{1:F5}" -f $dec[0].lat,$dec[0].lon)
Write-Host ("Last:  {0:F5},{1:F5}" -f $dec[-1].lat,$dec[-1].lon)

$lines = @()
for ($i=0; $i -lt $dec.Count; $i++) {
  $p = $dec[$i]
  $lines += "  { lat: $($p.lat.ToString('F5')), lon: $($p.lon.ToString('F5')) }"
}
("var OC_GAP_FILL = [`n" + ($lines -join ",`n") + "`n];") | Set-Content (Join-Path $root 'oc-gap-fill.js.txt') -Encoding UTF8
Write-Host "Wrote oc-gap-fill.js.txt"

# Pier check
$refs = @(
  @{ n='Seal Beach'; lat=33.741; lon=-118.104 },
  @{ n='HB pier'; lat=33.655; lon=-118.004 },
  @{ n='Newport'; lat=33.609; lon=-117.929 },
  @{ n='Laguna'; lat=33.542; lon=-117.789 },
  @{ n='Dana Point'; lat=33.462; lon=-117.716 }
)
foreach ($r in $refs) {
  $bd = 1e9; $bp = $null
  foreach ($p in $dec) {
    $d = DistM @($r.lat,$r.lon) @($p.lat,$p.lon)
    if ($d -lt $bd) { $bd = $d; $bp = $p }
  }
  Write-Host ("{0}: {1:F0}m ({2:F2} NM)" -f $r.n, $bd, ($bd/1852))
}
