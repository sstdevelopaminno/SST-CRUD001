$port = 3000

function Get-PortPids([int]$p) {
  $rows = netstat -ano | Select-String ":$p\s+" | ForEach-Object { $_.Line.Trim() }
  $pids = @()

  foreach ($row in $rows) {
    $parts = $row -split "\s+"
    if ($parts.Length -ge 5) {
      $state = $parts[3]
      $procId = $parts[4]
      if ($state -eq 'LISTENING' -and $procId -match '^\d+$') {
        $pids += [int]$procId
      }
    }
  }

  return $pids | Select-Object -Unique
}

$pids = @()

try {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids += ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  }
} catch {
  Write-Host "Get-NetTCPConnection unavailable, using netstat fallback" -ForegroundColor DarkYellow
}

$pids += Get-PortPids -p $port
$pids = $pids | Where-Object { $_ -and $_ -gt 0 } | Select-Object -Unique

foreach ($proc in $pids) {
  Write-Host "Stopping process on port $port (PID: $proc)" -ForegroundColor Yellow
  cmd /c "taskkill /PID $proc /F" | Out-Null
}

$cacheDirs = @("..\.next", "..\.next-dev")
foreach ($dir in $cacheDirs) {
  $path = Join-Path $PSScriptRoot $dir
  if (Test-Path $path) {
    Write-Host "Clearing cache at $path" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
  }
}

Write-Host "Starting Next.js on http://127.0.0.1:$port" -ForegroundColor Cyan
npx next dev -H 127.0.0.1 -p $port
