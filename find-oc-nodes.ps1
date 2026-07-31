# Find OSM nodes near OC pier landmarks in coast-osm.json
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Get-Content (Join-Path $root 'coast-osm.json') -Raw | ConvertFrom-Json
$refs = @(
  @{ n='Seal'; lat=33.741; lon=-118.104 },
  @{ n='HB'; lat=33.655; lon=-118.004 },
  @{ n='Newport'; lat=33.609; lon=-117.929 },
  @{ n='Dana'; lat=33.462; lon=-117.716 }
)
function DistM($a,$b) {
  $R=6371000; $p=[Math]::PI/180
  $dl=($b.lat-$a.lat)*$p; $do=($b.lon-$a.lon)*$p
  $la=$a.lat*$p; $lb=$b.lat*$p
  $h=[Math]::Sin($dl/2)*[Math]::Sin($dl/2)+[Math]::Cos($la)*[Math]::Cos($lb)*[Math]::Sin($do/2)*[Math]::Sin($do/2)
  return 2*$R*[Math]::Asin([Math]::Sqrt($h))
}
$nodes = @($raw.elements | Where-Object { $_.type -eq 'node' })
Write-Host "Total nodes: $($nodes.Count)"
foreach ($r in $refs) {
  $best = $null; $bd = 1e9
  foreach ($nd in $nodes) {
    $d = DistM $r @{ lat=$nd.lat; lon=$nd.lon }
    if ($d -lt $bd) { $bd = $d; $best = $nd }
  }
  Write-Host ("{0}: nearest node {1}m at {2:F5},{3:F5}" -f $r.n,$bd.ToString('F0'),$best.lat,$best.lon)
}
# bbox of all nodes lat 33.4-33.8
$oc = @($nodes | Where-Object { $_.lat -ge 33.45 -and $_.lat -le 33.78 -and $_.lon -ge -118.20 -and $_.lon -le -117.65 })
Write-Host "Nodes in OC bbox: $($oc.Count)"
if ($oc.Count -gt 0) {
  Write-Host ("lat {0:F3}..{1:F3} lon {2:F3}..{3:F3}" -f ($oc.lat | Measure-Object -Minimum).Minimum, ($oc.lat | Measure-Object -Maximum).Maximum, ($oc.lon | Measure-Object -Minimum).Minimum, ($oc.lon | Measure-Object -Maximum).Maximum)
}
