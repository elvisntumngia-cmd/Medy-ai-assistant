$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'dev.ps1'), [ref]$null, [ref]$errors)
if ($errors.Count) { throw 'Startup script syntax errors.' }
# Load helpers only, never the startup body.
foreach ($name in @('Get-MedyKind','Get-Owner','Stop-Verified')) {
  $definition = $ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name}, $true)
  Invoke-Expression $definition.Extent.Text
}
function Assert($condition, $message) { if (!$condition) { throw $message } }
function Assert-Throws($action, $message) {
  $threw = $false
  try { & $action } catch { $threw = $true }
  Assert $threw $message
}
$api = [pscustomobject]@{ProcessId=42;Name='node.exe';CommandLine=('node "{0}\node_modules\tsx\dist\cli.mjs" watch "{0}\apps\api\src\dev-server.ts"' -f $repo);CreationDate='same'}
$demo = [pscustomobject]@{ProcessId=43;Name='node.exe';CommandLine=('node "{0}\apps\demo\node_modules\vite\bin\vite.js" --port 5180 --strictPort' -f $repo);CreationDate='same'}
$other = [pscustomobject]@{ProcessId=99;Name='node.exe';CommandLine='node C:\other-repo\node_modules\vite\bin\vite.js --port 5180';CreationDate='same'}
Assert ((Get-MedyKind $api) -eq 'api') 'API ownership was not recognized.'
Assert ((Get-MedyKind $demo) -eq 'demo') 'Vite ownership was not recognized.'
Assert (!(Get-MedyKind $other)) 'An unrelated application was classified as Medy.'
Assert (!(Get-MedyKind ([pscustomobject]@{Name='node.exe';CommandLine=($repo+'-other\node_modules\tsx\dist\cli.mjs watch src/dev-server.ts')}))) 'A sibling repository was classified as Medy.'
Assert (!(Get-MedyKind ([pscustomobject]@{Name='node.exe';CommandLine=($repo+'\some-other-script.js')}))) 'A non-server repository process was classified as a server.'
$script:listeners = @([pscustomobject]@{LocalPort=4180;OwningProcess=42})
function Get-Listeners { return $script:listeners }
Assert (@(Get-Owner 4180 @($api,$demo,$other))[0] -eq 42) 'A verified listener was rejected.'
$script:listeners = @([pscustomobject]@{LocalPort=5180;OwningProcess=99})
Assert-Throws { Get-Owner 5180 @($api,$demo,$other) } 'An unrelated listener was accepted.'
$script:listeners = @([pscustomobject]@{LocalPort=5180;OwningProcess=42})
Assert-Throws { Get-Owner 5180 @($api,$demo) } 'A wrong-service listener was accepted.'
$script:listeners = @([pscustomobject]@{LocalPort=4180;OwningProcess=101})
Assert-Throws { Get-Owner 4180 @($api) } 'An unknown PID was accepted.'
$script:current = $api
$script:stopped = @()
function Get-CimInstance { param($ClassName,$Filter) return $script:current }
function Stop-Process { param($Id,$ErrorAction) $script:stopped += $Id }
Stop-Verified $api
Assert ($script:stopped.Count -eq 1 -and $script:stopped[0] -eq 42) 'The verified process was not stopped.'
$script:current = [pscustomobject]@{ProcessId=42;Name='node.exe';CommandLine=$api.CommandLine;CreationDate='changed'}
Assert-Throws { Stop-Verified $api } 'PID reuse was not rejected.'
Assert-Throws { Stop-Verified $other } 'Unverified process termination was accepted.'
Assert ($script:stopped.Count -eq 1) 'A rejected termination still called Stop-Process.'
Write-Host 'Development startup safety checks passed (all process actions mocked).'
