# Regenerate coast-geo.js (Windows fallback when Node.js is unavailable)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host 'Fetching Overpass coastline data…'
curl.exe -s -X POST "https://overpass-api.de/api/interpreter" `
  --data-binary "@overpass-query.txt" `
  -o "coast-osm.json" `
  -w "HTTP:%{http_code} SIZE:%{size_download}`n"

Write-Host 'Processing…'
& "$PSScriptRoot\process-coast.ps1"
