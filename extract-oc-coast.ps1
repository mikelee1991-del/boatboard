# Extract OC mainland coastline ways from coast-osm.json
$raw = Get-Content (Join-Path $PSScriptRoot 'coast-osm.json') -Raw | ConvertFrom-Json
$nodes = @{}
foreach ($el in $raw.elements) {
  if ($el.type -eq 'node') { $nodes["$($el.id)"] = $el }
}
$results = @()
foreach ($el in $raw.elements) {
  if ($el.type -ne 'way' -or -not $el.nodes) { continue }
  $oc = 0
  $pts = @()
  foreach ($nid in $el.nodes) {
    $n = $nodes["$nid"]
    if (-not $n) { continue }
    $pts += $n
    if ($n.lat -ge 33.52 -and $n.lat -le 33.78 -and $n.lon -ge -118.15 -and $n.lon -le -117.85) { $oc++ }
  }
  if ($oc -ge 8) {
    $s = $pts[0]; $e = $pts[-1]
    $results += [PSCustomObject]@{
      id = $el.id; pts = $pts.Count; oc = $oc
      start = "{0:F5},{1:F5}" -f $s.lat, $s.lon
      end = "{0:F5},{1:F5}" -f $e.lat, $e.lon
    }
  }
}
$results | Format-Table -AutoSize
Write-Host "Total OC ways: $($results.Count)"
