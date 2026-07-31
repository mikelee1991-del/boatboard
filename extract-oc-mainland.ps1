# Extract ordered OC mainland coastline from coast-osm.json
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Get-Content (Join-Path $root 'coast-osm.json') -Raw | ConvertFrom-Json
$nodes = @{}
foreach ($el in $raw.elements) {
  if ($el.type -eq 'node') { $nodes["$($el.id)"] = @{ lat = [double]$el.lat; lon = [double]$el.lon } }
}

function InOcBox($p) {
  return ($p.lat -ge 33.45 -and $p.lat -le 33.78 -and $p.lon -ge -118.14 -and $p.lon -le -117.68)
}

$ways = @()
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.nodes) { continue }
  $pts = @()
  foreach ($nid in $el.nodes) {
    $n = $nodes["$nid"]
    if ($n) { $pts += ,@($n.lat, $n.lon) }
  }
  if ($pts.Count -lt 5) { continue }
  $oc = @($pts | Where-Object { InOcBox @{ lat = $_[0]; lon = $_[1] } })
  if ($oc.Count -ge 8) {
    $ways += ,@($el.id, $pts, $oc.Count)
  }
}
Write-Host "OC ways found: $($ways.Count)"
foreach ($w in $ways) {
  $id = $w[0]; $pts = $w[1]; $oc = $w[2]
  $s = $pts[0]; $e = $pts[-1]
  Write-Host ("way {0} pts={1} oc={2} start={3:F5},{4:F5} end={5:F6},{6:F5}" -f $id,$pts.Count,$oc,$s[0],$s[1],$e[0],$e[1])
}

# Pick longest mainland way in OC box (exclude Catalina-ish west lon)
$best = $null; $bestOc = 0
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.nodes) { continue }
  $pts = @()
  foreach ($nid in $el.nodes) {
    $n = $nodes["$nid"]
    if ($n -and $n.lon -gt -118.12) { $pts += $n }
  }
  if ($pts.Count -lt 20) { continue }
  $inBox = @($pts | Where-Object { $_.lat -ge 33.46 -and $_.lat -le 33.76 -and $_.lon -ge -118.12 -and $_.lon -le -117.70 })
  if ($inBox.Count -gt $bestOc) { $bestOc = $inBox.Count; $best = $inBox }
}
Write-Host "Best mainland pts in box: $bestOc"
if ($best) {
  # Order north to south by lat descending
  $ordered = $best | Sort-Object { -$_.lat }
  $out = Join-Path $root 'oc-mainland-trace.txt'
  $ordered | ForEach-Object { "{0:F5},{1:F5}" -f $_.lat, $_.lon } | Set-Content $out
  Write-Host "Wrote $($ordered.Count) pts to oc-mainland-trace.txt"
  Write-Host "First: $($ordered[0].lat), $($ordered[0].lon)"
  Write-Host "Last:  $($ordered[-1].lat), $($ordered[-1].lon)"
}
