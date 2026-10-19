param(
  [switch]$OpenAI,
  [switch]$Restart,
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$hash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($repo.ToLowerInvariant()))).Replace('-', '')
$mutex = [Threading.Mutex]::new($false, "Local\MedyDev-$hash")
$locked = $false
function Get-MedyKind($process) {
  if (!$process -or $process.Name -ne 'node.exe' -or !$process.CommandLine) { return '' }
  $command = $process.CommandLine.Replace('/', '\')
  if ($command.IndexOf($repo + '\', [StringComparison]::OrdinalIgnoreCase) -lt 0) { return '' }
  if ($command -match '(?:src\\|src/)dev-server\.ts(?:["\s]|$)' -and $command -match 'tsx') { return 'api' }
  if ($command -match 'vite\\bin\\vite\.js(?:["\s]|$)') { return 'demo' }
  return ''
}
function Get-Listeners {
  # Fail closed if Windows denies process/port inspection.
  return @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in @(4180,5180) })
}
function Get-Owner($port, $processes) {
  $ids = @(Get-Listeners | Where-Object LocalPort -eq $port | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($ownerId in $ids) {
    $owner = $processes | Where-Object ProcessId -eq $ownerId | Select-Object -First 1
    $expected = if ($port -eq 4180) { 'api' } else { 'demo' }
    if ((Get-MedyKind $owner) -ne $expected) {
      throw "Port $port belongs to PID $ownerId with unverified ownership. Nothing will be stopped. Inspect its command line and resolve the conflict explicitly."
    }
  }
  return $ids
}
function Stop-Verified($process) {
  if (!(Get-MedyKind $process)) { throw "Refusing to stop a process with unverified ownership." }
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
  if (!$current) { return }
  if ($current.CreationDate -ne $process.CreationDate -or (Get-MedyKind $current) -ne (Get-MedyKind $process)) {
    throw "PID $($process.ProcessId) changed identity; refusing to stop it."
  }
  Stop-Process -Id $current.ProcessId -ErrorAction Stop
  Write-Host "Stopped verified Medy $(Get-MedyKind $current) PID $($current.ProcessId)."
}
function Wait-Ready($url) {
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1
      if ($response.StatusCode -eq 200) { return $response }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "Server did not become ready at $url. Inspect .medy-dev logs locally; no alternate port was selected."
}
try {
  try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
  if (!$locked) { throw 'Another Medy startup is running. Wait for it to finish.' }
  $processes = @(Get-CimInstance Win32_Process)
  # Check BOTH ports before changing any process.
  $apiOwners = @(Get-Owner 4180 $processes)
  $demoOwners = @(Get-Owner 5180 $processes)
  $owned = @($processes | Where-Object { (Get-MedyKind $_) -ne '' })
  $activeIds = @($apiOwners + $demoOwners)
  foreach ($ownerId in @($activeIds)) {
    $ancestor = $processes | Where-Object ProcessId -eq $ownerId | Select-Object -First 1
    while ($ancestor -and (Get-MedyKind $ancestor) -ne '') {
      $activeIds += $ancestor.ProcessId
      $ancestor = $processes | Where-Object ProcessId -eq $ancestor.ParentProcessId | Select-Object -First 1
    }
  }
  $restartApi = [bool]$Restart
  if ($OpenAI -and $apiOwners.Count -gt 0 -and !$Restart -and !$Stop) {
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4180/api/health' -TimeoutSec 3
      $restartApi = $health.publicProvider -ne 'openai' -or !$health.systemCA
    } catch { $restartApi = $true }
  }
  # Stop watchers before their children so they cannot respawn listeners.
  $toStop = @($owned | Where-Object {
    $Stop -or $Restart -or ($restartApi -and (Get-MedyKind $_) -eq 'api') -or $_.ProcessId -notin $activeIds
  } | Sort-Object @{Expression={ if ($_.CommandLine -match '\bwatch\b') { 0 } else { 1 } }})
  foreach ($process in $toStop) { Stop-Verified $process }
  if ($Stop) { Write-Host 'Verified Medy development servers stopped.'; return }
  if ($toStop.Count -gt 0) { Start-Sleep -Milliseconds 700 }
  $processes = @(Get-CimInstance Win32_Process)
  $apiOwners = @(Get-Owner 4180 $processes)
  $demoOwners = @(Get-Owner 5180 $processes)
  $logDir = Join-Path $repo '.medy-dev'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $started = @()
  try {
    if ($apiOwners.Count -eq 0) {
      $oldProvider = $env:AI_PROVIDER
      $oldLocal = $env:MEDY_LOCAL_AI
      $oldPort = $env:PORT
      $oldNodeOptions = $env:NODE_OPTIONS
      try {
        if ($OpenAI) { $env:AI_PROVIDER = 'openai'; $env:MEDY_LOCAL_AI = 'true' }
        $env:PORT = '4180'
        # tsx watch does not forward all CLI flags, so propagate trust to its worker via NODE_OPTIONS.
        if ($env:NODE_OPTIONS -notmatch '(?:^|\s)--use-system-ca(?:\s|$)') { $env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --use-system-ca').Trim() }
        $cli = Join-Path $repo 'node_modules\tsx\dist\cli.mjs'
        $entry = Join-Path $repo 'apps\api\src\dev-server.ts'
        $arguments = @(('"{0}"' -f $cli), 'watch', ('"{0}"' -f $entry))
        $p = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory (Join-Path $repo 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'api.out.log') -RedirectStandardError (Join-Path $logDir 'api.err.log')
        $started += $p.Id
        Write-Host "Started Medy API watcher PID $($p.Id) on port 4180."
      } finally {
        $env:AI_PROVIDER = $oldProvider; $env:MEDY_LOCAL_AI = $oldLocal; $env:PORT = $oldPort; $env:NODE_OPTIONS = $oldNodeOptions
      }
    } else { Write-Host "Reusing verified Medy API listener PID $($apiOwners -join ', ')." }
    if ($demoOwners.Count -eq 0) {
      $cli = Join-Path $repo 'apps\demo\node_modules\vite\bin\vite.js'
      if (!(Test-Path -LiteralPath $cli)) { $cli = Join-Path $repo 'node_modules\vite\bin\vite.js' }
      $oldUrl = $env:VITE_API_URL
      try {
        $env:VITE_API_URL = 'http://127.0.0.1:4180/api'
        $arguments = @(('"{0}"' -f $cli), '--host', '127.0.0.1', '--port', '5180', '--strictPort')
        $p = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory (Join-Path $repo 'apps\demo') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'demo.out.log') -RedirectStandardError (Join-Path $logDir 'demo.err.log')
        $started += $p.Id
        Write-Host "Started Medy Vite PID $($p.Id) on port 5180."
      } finally { $env:VITE_API_URL = $oldUrl }
    } else { Write-Host "Reusing verified Medy Vite listener PID $($demoOwners -join ', ')." }
    $api = (Wait-Ready 'http://127.0.0.1:4180/api/health').Content | ConvertFrom-Json
    $null = Wait-Ready 'http://127.0.0.1:5180/'
    if ($api.status -ne 'ok') { throw 'The API health response was not healthy.' }
    if ($OpenAI -and $api.publicProvider -ne 'openai') {
      throw 'OpenAI was requested but is not active. Check the key/configuration locally; no live API request was made.'
    }
    # Verify the served Vite configuration; never print environment values or source.
    $source = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5180/src/main.tsx' -TimeoutSec 5).Content
    $match = [regex]::Match($source, '"VITE_API_URL"\s*:\s*"([^"]*)"')
    if ($match.Success -and $match.Groups[1].Value -and $match.Groups[1].Value -notin @('http://127.0.0.1:4180/api','http://localhost:4180/api')) {
      throw 'Existing Vite uses a different API URL. Run npm run dev:openai -- -Restart to restart verified Medy servers with the local API URL.'
    }
    Write-Host "Ready: http://127.0.0.1:5180 -> http://127.0.0.1:4180/api"
    if ($api.publicProvider) { Write-Host "Public chat provider: $($api.publicProvider)" }
    else { Write-Host 'Provider health metadata unavailable; restart the API to load the current code.' }
    Write-Host 'Servers run in the background. Stop with npm run dev:stop; restart after environment edits with npm run dev -- -Restart.'
  } catch {
    # Roll back only processes created by THIS invocation, including their verified API children.
    $current = @(Get-CimInstance Win32_Process)
    foreach ($child in @($current | Where-Object { $_.ProcessId -in $started -and (Get-MedyKind $_) -ne '' })) { Stop-Verified $child }
    foreach ($child in @($current | Where-Object { $_.ParentProcessId -in $started -and (Get-MedyKind $_) -ne '' })) { Stop-Verified $child }
    throw
  }
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
