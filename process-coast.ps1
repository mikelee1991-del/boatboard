# Process coast-osm.json -> coast-geo.js (mirrors fetch-coast.mjs)
param(
  [string]$InputFile = "coast-osm.json",
  [string]$OutputFile = "coast-geo.js"
)

$PRIORITY = @{ south = 33.68; west = -118.85; north = 33.95; east = -118.20 }
$DP_TOL = 0.001

$ISLAND_BOXES = @(
  @{ name = 'Santa Catalina Island'; south = 33.28; west = -118.55; north = 33.48; east = -118.28 },
  @{ name = 'San Clemente Island'; south = 32.87; west = -118.62; north = 33.15; east = -118.34 },
  @{ name = 'San Nicolas Island'; south = 33.22; west = -119.75; north = 33.37; east = -119.44 },
  @{ name = 'Anacapa Island'; south = 33.96; west = -119.40; north = 34.03; east = -119.30 },
  @{ name = 'Santa Cruz Island'; south = 33.95; west = -119.80; north = 34.08; east = -119.34 },
  @{ name = 'Santa Rosa Island'; south = 33.92; west = -120.18; north = 34.07; east = -119.80 }
)

$LAND_BOXES = @(
  @{ name = 'Palos Verdes Peninsula'; south = 33.68; west = -118.48; north = 33.84; east = -118.30 }
)

function Round6($n) { return [math]::Round([double]$n, 6) }
function InPriority($p) {
  return $p.lat -ge $PRIORITY.south -and $p.lat -le $PRIORITY.north -and
         $p.lon -ge $PRIORITY.west -and $p.lon -le $PRIORITY.east
}
function KeyPt($p) { return "$(Round6 $p.lat),$(Round6 $p.lon)" }

function SqDistToSeg($p, $a, $b) {
  $dx = $b.lon - $a.lon; $dy = $b.lat - $a.lat
  if ($dx -eq 0 -and $dy -eq 0) {
    $ex = $p.lon - $a.lon; $ey = $p.lat - $a.lat
    return $ex*$ex + $ey*$ey
  }
  $t = (($p.lon - $a.lon)*$dx + ($p.lat - $a.lat)*$dy) / ($dx*$dx + $dy*$dy)
  if ($t -lt 0) { $t = 0 } elseif ($t -gt 1) { $t = 1 }
  $ex = $p.lon - ($a.lon + $t*$dx); $ey = $p.lat - ($a.lat + $t*$dy)
  return $ex*$ex + $ey*$ey
}

function DouglasPeucker {
  param([array]$Pts, [double]$Tol, [bool[]]$Keep)
  $pts = $Pts; $tol = $Tol; $keep = $Keep
  $n = @($pts).Count
  if ($n -le 2) { return ,$keep }
  $tol2 = $tol * $tol
  $marked = [bool[]]$keep.Clone()
  $stack = New-Object System.Collections.Stack
  $null = $stack.Push([int[]]@(0, $n - 1))
  while ($stack.Count -gt 0) {
    $range = $stack.Pop()
    $start = $range[0]; $end = $range[1]
    if ($end - $start -lt 2) { continue }
    $maxD = 0.0; $idx = -1
    for ($i = $start + 1; $i -lt $end; $i++) {
      if ($marked[$i]) { continue }
      $d = SqDistToSeg $pts[$i] $pts[$start] $pts[$end]
      if ($d -gt $maxD) { $maxD = $d; $idx = $i }
    }
    if ($maxD -gt $tol2 -and $idx -ge 0) {
      $marked[$idx] = $true
      $null = $stack.Push([int[]]@($start, $idx))
      $null = $stack.Push([int[]]@($idx, $end))
    }
  }
  return ,$marked
}

function SimplifyPolyline($pts) {
  $n = @($pts).Length
  if ($n -le 2) { return @($pts) }
  $keep = New-Object bool[] $n
  for ($i = 0; $i -lt $n; $i++) { $keep[$i] = InPriority $pts[$i] }
  $keep[0] = $true; $keep[$n - 1] = $true
  $marked = DouglasPeucker -Pts $pts -Tol $DP_TOL -Keep $keep
  $out = @()
  for ($i = 0; $i -lt $n; $i++) { if ($marked[$i]) { $out += $pts[$i] } }
  return $out
}

function ChainBbox($chain) {
  $s = [double]::MaxValue; $n = [double]::MinValue
  $w = [double]::MaxValue; $e = [double]::MinValue
  foreach ($p in $chain) {
    if ($p.lat -lt $s) { $s = $p.lat }
    if ($p.lat -gt $n) { $n = $p.lat }
    if ($p.lon -lt $w) { $w = $p.lon }
    if ($p.lon -gt $e) { $e = $p.lon }
  }
  return @{ south = $s; north = $n; west = $w; east = $e }
}

function BboxArea($b) {
  $h = $b.north - $b.south; $wd = $b.east - $b.west
  if ($h -le 0 -or $wd -le 0) { return 0 }
  return $h * $wd
}

function BboxOverlapArea($a, $b) {
  $s = [math]::Max($a.south, $b.south); $n = [math]::Min($a.north, $b.north)
  $w = [math]::Max($a.west, $b.west); $e = [math]::Min($a.east, $b.east)
  if ($s -ge $n -or $w -ge $e) { return 0 }
  return ($n - $s) * ($e - $w)
}

function MatchIsland($chain) {
  $bb = ChainBbox $chain
  $latSum = 0; $lonSum = 0
  foreach ($p in $chain) { $latSum += $p.lat; $lonSum += $p.lon }
  $c = @{ lat = $latSum / $chain.Count; lon = $lonSum / $chain.Count }
  foreach ($box in $ISLAND_BOXES) {
    if ($c.lat -ge $box.south -and $c.lat -le $box.north -and $c.lon -ge $box.west -and $c.lon -le $box.east) {
      return $box.name
    }
    $overlap = (BboxOverlapArea $bb $box) / (BboxArea $bb)
    if ($overlap -ge 0.35) { return $box.name }
  }
  return $null
}

function MatchNamedBox($chain, $boxes, $minRatio) {
  $bb = ChainBbox $chain
  $area = BboxArea $bb
  if ($area -le 0) { return $null }
  $best = $null; $bestScore = 0
  foreach ($box in $boxes) {
    $score = (BboxOverlapArea $bb $box) / $area
    if ($score -gt $bestScore -and $score -ge $minRatio) { $bestScore = $score; $best = $box.name }
  }
  return $best
}

function IsClosed($chain) {
  $n = @($chain).Length
  if ($n -lt 4) { return $false }
  $a = $chain[0]; $b = $chain[$n - 1]
  return [math]::Abs($a.lat - $b.lat) -lt 0.0002 -and [math]::Abs($a.lon - $b.lon) -lt 0.0002
}

function CloseRing($pts) {
  $n = @($pts).Length
  if ($n -lt 3) { return @($pts) }
  $a = $pts[0]; $b = $pts[$n - 1]
  if ([math]::Abs($a.lat - $b.lat) -lt 1e-6 -and [math]::Abs($a.lon - $b.lon) -lt 1e-6) { return @($pts) }
  return @($pts) + @(@{ lat = $a.lat; lon = $a.lon })
}

function PointRegionName($p) {
  if ($p.lat -ge 33.68 -and $p.lat -le 33.84 -and $p.lon -ge -118.48 -and $p.lon -le -118.30) {
    if ($p.lat -lt 33.76) { return 'pv-south' } else { return 'pv-north' }
  }
  if ($p.lat -ge 33.84 -and $p.lat -le 33.92 -and $p.lon -ge -118.45 -and $p.lon -le -118.32) { return 'south-bay' }
  if ($p.lat -ge 33.92 -and $p.lat -le 34.05 -and $p.lon -ge -118.85 -and $p.lon -le -118.45) { return 'santa-monica' }
  if ($p.lat -ge 33.55 -and $p.lat -le 33.72 -and $p.lon -ge -118.05 -and $p.lon -le -117.55) { return 'oc-south' }
  if ($p.lat -ge 33.72 -and $p.lat -le 33.95 -and $p.lon -ge -118.05 -and $p.lon -le -117.75) { return 'oc-north' }
  if ($p.lon -le -118.85 -and $p.lat -ge 33.95) { return 'malibu' }
  if ($p.lon -le -119.0) { return 'channel-coast' }
  return 'coast-other'
}

function SplitOpenChain($chain) {
  $n = @($chain).Length
  if ($n -lt 2) { return @() }
  $segments = @()
  $curName = PointRegionName $chain[0]
  $cur = @($chain[0])
  for ($i = 1; $i -lt $n; $i++) {
    $name = PointRegionName $chain[$i]
    if ($name -ne $curName -and $cur.Length -ge 2) {
      $segments += @{ name = $curName; pts = @($cur) }
      $cur = @($cur[$cur.Length - 1], $chain[$i])
      $curName = $name
    } else {
      $cur += $chain[$i]
    }
  }
  if ($cur.Length -ge 2) { $segments += @{ name = $curName; pts = @($cur) } }
  $counts = @{}
  $out = @()
  foreach ($s in $segments) {
    if (-not $counts.ContainsKey($s.name)) { $counts[$s.name] = 0 }
    $counts[$s.name]++
    $suffix = if ($counts[$s.name] -gt 1) { "-$($counts[$s.name])" } else { '' }
    $out += @{ name = "$($s.name)$suffix"; pts = $s.pts }
  }
  return $out
}

function BuildChains($ways) {
  $used = @{}
  $chains = @()
  foreach ($way in $ways) {
    if ($used.ContainsKey($way.id)) { continue }
    $used[$way.id] = $true
    $chain = [System.Collections.ArrayList]@($way.pts)
    $changed = $true
    while ($changed) {
      $changed = $false
      $hk = KeyPt $chain[0]; $tk = KeyPt $chain[$chain.Count - 1]
      foreach ($w in $ways) {
        if ($used.ContainsKey($w.id) -or $w.pts.Count -lt 2) { continue }
        $wh = KeyPt $w.pts[0]; $wt = KeyPt $w.pts[$w.pts.Count - 1]
        if ($tk -eq $wh) {
          for ($i = 1; $i -lt $w.pts.Count; $i++) { $null = $chain.Add($w.pts[$i]) }
          $used[$w.id] = $true; $changed = $true; break
        }
        if ($tk -eq $wt) {
          for ($i = $w.pts.Count - 2; $i -ge 0; $i--) { $null = $chain.Add($w.pts[$i]) }
          $used[$w.id] = $true; $changed = $true; break
        }
        if ($hk -eq $wt) {
          for ($i = $w.pts.Count - 2; $i -ge 0; $i--) { $null = $chain.Insert(0, $w.pts[$i]) }
          $used[$w.id] = $true; $changed = $true; break
        }
        if ($hk -eq $wh) {
          for ($i = $w.pts.Count - 1; $i -ge 1; $i--) { $null = $chain.Insert(0, $w.pts[$i]) }
          $used[$w.id] = $true; $changed = $true; break
        }
      }
    }
    $chains += ,@($chain.ToArray())
  }
  return $chains
}

function FmtPt($p) { return "{lat:$([math]::Round([double]$p.lat,6)),lon:$([math]::Round([double]$p.lon,6))}" }

$data = Get-Content $InputFile -Raw | ConvertFrom-Json
$ways = @()
foreach ($el in $data.elements) {
  if ($el.type -ne 'way' -or -not $el.geometry) { continue }
  $pts = @()
  foreach ($g in $el.geometry) { $pts += @{ lat = [double]$g.lat; lon = [double]$g.lon } }
  $ways += @{ id = [string]$el.id; pts = $pts }
}

Write-Host "Coastline ways: $($ways.Count)"
$chains = BuildChains $ways
Write-Host "Connected chains: $($chains.Count)"

$lines = @(); $islands = @(); $land = @()
$usedLand = @{}
$islandCandidates = @{}

function Consider-Island($name, $chain) {
  if (-not $name -or $chain.Count -lt 80) { return }
  if (-not $islandCandidates.ContainsKey($name) -or $chain.Count -gt $islandCandidates[$name].Count) {
    $islandCandidates[$name] = $chain
  }
}

foreach ($chain in $chains) {
  $closed = IsClosed $chain
  $islandName = MatchIsland $chain

  if ($islandName -and $chain.Count -ge 80) {
    Consider-Island $islandName $chain
    continue
  }

  if ($closed) {
    $simp = SimplifyPolyline $chain
    foreach ($lb in $LAND_BOXES) {
      if ($usedLand.ContainsKey($lb.name)) { continue }
      if ((MatchNamedBox $chain @($lb) 0.2) -and $chain.Count -ge 20) {
        $land += @{ name = $lb.name; pts = CloseRing $simp }
        $usedLand[$lb.name] = $true
        break
      }
    }
    continue
  }

  $simp = SimplifyPolyline $chain
  foreach ($seg in (SplitOpenChain $simp)) {
    if ($seg.pts.Count -ge 2) { $lines += $seg }
  }
}

foreach ($kv in $islandCandidates.GetEnumerator()) {
  $islands += @{ name = $kv.Key; pts = CloseRing $kv.Value }
}

$stats = @{
  lines = @($lines | ForEach-Object { @{ name = $_.name; pts = $_.pts.Count } })
  islands = @($islands | ForEach-Object { @{ name = $_.name; pts = $_.pts.Count } })
  land = @($land | ForEach-Object { @{ name = $_.name; pts = $_.pts.Count } })
  totals = @{
    linePts = ($lines | ForEach-Object { $_.pts.Count } | Measure-Object -Sum).Sum
    islandPts = ($islands | ForEach-Object { $_.pts.Count } | Measure-Object -Sum).Sum
    landPts = ($land | ForEach-Object { $_.pts.Count } | Measure-Object -Sum).Sum
    rawWays = $ways.Count
    rawNodes = ($ways | ForEach-Object { $_.pts.Count } | Measure-Object -Sum).Sum
  }
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/** OpenStreetMap coastline — Southern California (ODbL). Generated by fetch-coast.mjs */')
[void]$sb.AppendLine('window.COAST_GEO = {')
[void]$sb.AppendLine('  lines: [')
foreach ($l in $lines) {
  $ptsStr = ($l.pts | ForEach-Object { FmtPt $_ }) -join ','
  [void]$sb.AppendLine("    { name: '$($l.name)', pts: [$ptsStr] },")
}
[void]$sb.AppendLine('  ],')
[void]$sb.AppendLine('  islands: [')
foreach ($l in $islands) {
  $ptsStr = ($l.pts | ForEach-Object { FmtPt $_ }) -join ','
  [void]$sb.AppendLine("    { name: '$($l.name)', pts: [$ptsStr] },")
}
[void]$sb.AppendLine('  ],')
[void]$sb.AppendLine('  land: [')
foreach ($l in $land) {
  $ptsStr = ($l.pts | ForEach-Object { FmtPt $_ }) -join ','
  [void]$sb.AppendLine("    { name: '$($l.name)', pts: [$ptsStr] },")
}
[void]$sb.AppendLine('  ]')
[void]$sb.AppendLine('};')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('/* Point counts: ' + ($stats | ConvertTo-Json -Compress -Depth 5) + ' */')

[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutputFile), $sb.ToString())
Write-Host "Wrote $OutputFile"
$stats | ConvertTo-Json -Depth 5
