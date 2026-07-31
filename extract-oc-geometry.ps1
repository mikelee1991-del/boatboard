# Extract OC mainland coastline from coast-osm.json ways with geometry
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Get-Content (Join-Path $root 'coast-osm.json') -Raw | ConvertFrom-Json

function InMainlandOc($lat, $lon) {
  return ($lat -ge 33.46 -and $lat -le 33.76 -and $lon -ge -118.13 -and $lon -le -117.68)
}

$segments = @()
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.geometry) { continue }
  $pts = @()
  foreach ($g in $el.geometry) {
    $lat = [double]$g.lat; $lon = [double]$g.lon
    if (InMainlandOc $lat $lon) { $pts += ,@($lat, $lon) }
  }
  if ($pts.Count -ge 6) {
    $segments += ,@($el.id, $pts)
  }
}
Write-Host "Mainland OC segments: $($segments.Count)"
foreach ($s in $segments | Select-Object -First 15) {
  $id = $s[0]; $p = $s[1]
  Write-Host ("way {0} ocPts={1} start={2:F5},{3:F5} end={4:F5},{5:F5}" -f $id,$p.Count,$p[0][0],$p[0][1],$p[-1][0],$p[-1][1])
}

# Collect all OC mainland points
$all = New-Object System.Collections.Generic.List[object]
foreach ($s in $segments) {
  foreach ($p in $s[1]) { $all.Add(@{ lat = $p[0]; lon = $p[1] }) }
}
Write-Host "Total OC mainland pts (with dupes): $($all.Count)"

# Dedupe by rounded coord
$uniq = @{}
$deduped = @()
foreach ($p in $all) {
  $k = '{0:F5},{1:F5}' -f $p.lat, $p.lon
  if (-not $uniq.ContainsKey($k)) { $uniq[$k] = $true; $deduped += $p }
}
Write-Host "Deduped pts: $($deduped.Count)"

# Sort north to south (desc lat) — rough ordering for open coast facing SW
$ordered = $deduped | Sort-Object { -$_.lat }, { $_.lon }
$outPath = Join-Path $root 'oc-mainland-trace.txt'
$ordered | ForEach-Object { '{0:F5},{1:F5}' -f $_.lat, $_.lon } | Set-Content $outPath
Write-Host "Wrote $outPath"
