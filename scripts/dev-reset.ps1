$port = 3000

try {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      Write-Host "Stopping process on port $port (PID: $pid)" -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Host "Could not inspect port $port, continuing..." -ForegroundColor DarkYellow
}

Write-Host "Starting Next.js on http://127.0.0.1:$port" -ForegroundColor Cyan
npx next dev -H 127.0.0.1 -p $port
