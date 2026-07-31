# Post-edit water-pin audit — runs after edits to dive/fish/coast files.
# Input: JSON on stdin (afterFileEdit hook payload).
# Output: JSON with additional_context if scans fail.

$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
  $payload = $raw | ConvertFrom-Json
} catch {
  exit 0
}

$path = ''
if ($payload.path) { $path = [string]$payload.path }
elseif ($payload.file_path) { $path = [string]$payload.file_path }
elseif ($payload.filePath) { $path = [string]$payload.filePath }

$norm = $path -replace '\\', '/'
$watch = @(
  'dive-engine.js',
  'index.html',
  'coast-geo.js',
  'coast-overlay-lite.js',
  'location-audit-core.js',
  'scan-fish-onshore.js',
  'scan-dive-onshore.js',
  'audit-map-water-pins.js',
  'audit-all-water-pins.js',
  'scripts/expand-libraries.mjs',
  'fix-coast-pv-fast.js'
)
$hit = $false
foreach ($w in $watch) {
  if ($norm -match [regex]::Escape($w)) { $hit = $true; break }
}
if (-not $hit) { exit 0 }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $root 'audit-all-water-pins.js'))) {
  $root = Get-Location
}

$audit = Join-Path $root 'audit-all-water-pins.js'
if (-not (Test-Path $audit)) { exit 0 }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cscript.exe'
$psi.Arguments = "//Nologo `"$audit`""
$psi.WorkingDirectory = $root
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
$out = $p.StandardOutput.ReadToEnd()
$err = $p.StandardError.ReadToEnd()
$p.WaitForExit()
$combined = ($out + "`n" + $err).Trim()

if ($p.ExitCode -eq 0) { exit 0 }

$msg = @(
  'Water-pin audit FAILED after editing location/coast files.',
  'Run: cscript //Nologo audit-all-water-pins.js',
  'Fix all FAIL rows to in-water targets, then re-run until exit 0.',
  '',
  $combined
) -join "`n"

$resp = @{ additional_context = $msg } | ConvertTo-Json -Compress
Write-Output $resp
exit 0
