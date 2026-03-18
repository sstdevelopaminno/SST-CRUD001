$ErrorActionPreference = "Stop"

function Get-EnvMap {
  param([string]$Path)

  if (!(Test-Path $Path)) {
    throw "Missing $Path"
  }

  $map = @{}
  Get-Content $Path | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "^\s*$") { return }
    if ($_ -match "^(?<k>[A-Z0-9_]+)=(?<v>.*)$") {
      $k = $matches.k
      $v = $matches.v.Trim().TrimEnd("`r", "`n")
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      $map[$k] = $v.TrimEnd("`r", "`n")
    }
  }

  return $map
}

function Invoke-Vercel {
  param(
    [string]$CommandArgs,
    [switch]$IgnoreError
  )

  $cmd = "vercel $CommandArgs$($script:TokenArg)"
  $maskedCmd = "vercel $CommandArgs"

  cmd /c $cmd

  if ($LASTEXITCODE -ne 0 -and -not $IgnoreError) {
    throw "Command failed: $maskedCmd"
  }
}

function Invoke-VercelWithFileInput {
  param(
    [string]$CommandArgs,
    [string]$FilePath,
    [switch]$IgnoreError
  )

  $pipeCmd = "type `"$FilePath`" | vercel $CommandArgs$($script:TokenArg)"
  $maskedCmd = "vercel $CommandArgs"

  cmd /c $pipeCmd

  if ($LASTEXITCODE -ne 0 -and -not $IgnoreError) {
    throw "Command failed: $maskedCmd"
  }
}

function Ensure-VercelAuth {
  if (-not [string]::IsNullOrWhiteSpace($script:VercelToken)) {
    Invoke-Vercel -CommandArgs "whoami"
    return
  }

  Invoke-Vercel -CommandArgs "whoami" -IgnoreError
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Host "No Vercel credentials found for this terminal session." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Set VERCEL_TOKEN first (recommended)" -ForegroundColor Cyan
  Write-Host "1) Create token at: https://vercel.com/account/tokens"
  Write-Host "2) Put it in .env.local as: VERCEL_TOKEN=your_token"
  Write-Host "3) Run again: cmd /c npm run vercel:sync"

  throw "Vercel authentication is required before syncing env/deploy."
}

function Add-VercelEnv {
  param(
    [string]$Key,
    [string]$Target,
    [string]$Value
  )

  # Remove existing value first to avoid interactive overwrite prompt.
  Invoke-Vercel -CommandArgs "env rm $Key $Target -y" -IgnoreError

  $tmpFile = New-TemporaryFile
  try {
    Set-Content -Path $tmpFile -Value $Value -NoNewline
    Invoke-VercelWithFileInput -CommandArgs "env add $Key $Target" -FilePath $tmpFile
  }
  finally {
    Remove-Item -Force $tmpFile -ErrorAction SilentlyContinue
  }
}

$envMap = Get-EnvMap ".env.local"

$script:VercelToken = $env:VERCEL_TOKEN
if ([string]::IsNullOrWhiteSpace($script:VercelToken) -and $envMap.ContainsKey("VERCEL_TOKEN")) {
  $script:VercelToken = $envMap["VERCEL_TOKEN"]
}

$script:TokenArg = ""
if (-not [string]::IsNullOrWhiteSpace($script:VercelToken)) {
  $script:TokenArg = " --token $($script:VercelToken)"
}

$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
)

$missing = @()
foreach ($k in $required) {
  if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
    $missing += $k
  }
}

if ($missing.Count -gt 0) {
  throw ("Missing required keys in .env.local: " + ($missing -join ", "))
}

Write-Host "Checking Vercel authentication..."
Ensure-VercelAuth

if (!(Test-Path ".vercel\project.json")) {
  Write-Host "Linking this folder to Vercel project..."
  Invoke-Vercel -CommandArgs "link --yes"
}

$targets = @("production", "preview", "development")
foreach ($target in $targets) {
  foreach ($k in $required) {
    Add-VercelEnv -Key $k -Target $target -Value $envMap[$k]
    Write-Host "Updated $k on $target"
  }
}

if ($envMap.ContainsKey("NEXT_PUBLIC_APP_URL") -and -not [string]::IsNullOrWhiteSpace($envMap["NEXT_PUBLIC_APP_URL"])) {
  foreach ($target in $targets) {
    Add-VercelEnv -Key "NEXT_PUBLIC_APP_URL" -Target $target -Value $envMap["NEXT_PUBLIC_APP_URL"]
    Write-Host "Updated NEXT_PUBLIC_APP_URL on $target"
  }
}

Write-Host "Deploying production..."
Invoke-Vercel -CommandArgs "--prod --yes"

Write-Host "Done."
