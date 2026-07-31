# Survey coast-osm.json coverage near Orange County
$raw = Get-Content (Join-Path $PSScriptRoot 'coast-osm.json') -Raw | ConvertFrom-Json
$nodes = @{}
foreach ($el in $raw.elements) {
  if ($el.type -eq 'node') { $nodes["$($el.id)"] = $el }
}
Write-Host "Elements: $($raw.elements.Count) Nodes: $($nodes.Count)"
$ways = @($raw.elements | Where-Object { $_.type -eq 'way' })
Write-Host "Ways: $($ways.Count)"

function Way-Bbox($way) {
  $latMin=999; $latMax=-999; $lonMin=999; $lonMax=-999; $n=0
  foreach ($nid in $way.nodes) {
    $nd = $nodes["$nid"]; if (-not $nd) { continue }
    $n++
    if ($nd.lat -lt $latMin) { $latMin = $nd.lat }
    if ($nd.lat -gt $latMax) { $latMax = $nd.lat }
    if ($nd.lon -lt $lonMin) { $lonMin = $nd.lon }
    if ($nd.lon -gt $lonMax) { $lonMax = $nd.lon }
  }
  return @{ n=$n; latMin=$latMin; latMax=$latMax; lonMin=$lonMin; lonMax=$lonMax }
}

Write-Host "`nWays overlapping lat 33.5-33.8 lon -118.2--117.7:"
foreach ($w in $ways) {
  $bb = Way-Bbox $w
  if ($bb.n -lt 5) { continue }
  if ($bb.latMax -lt 33.5 -or $bb.latMin -gt 33.8) { continue }
  if ($bb.lonMax -lt -118.2 -or $bb.lonMin -gt -117.7) { continue }
  Write-Host ("way {0} pts={1} bbox lat {2:F3}..{3:F3} lon {4:F3}..{5:F3}" -f $w.id,$bb.n,$bb.latMin,$bb.latMax,$bb.lonMin,$bb.lonMax)
}
