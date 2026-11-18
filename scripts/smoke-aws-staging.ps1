param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [string[]]$Origins = @(
    "https://new.securemedy.com",
    "https://www.securemedy.com"
  ),
  [switch]$IncludeThrottlingCheck
)

$ErrorActionPreference = "Stop"
$base = $ApiBaseUrl.TrimEnd("/")
$Origin = $Origins[0]
$headers = @{ Origin = $Origin; "Content-Type" = "application/json" }

function Invoke-MedyJson {
  param([string]$Method, [string]$Path, [object]$Body)
  $parameters = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers }
  if ($null -ne $Body) { $parameters.Body = $Body | ConvertTo-Json -Depth 8 }
  Invoke-RestMethod @parameters
}

$health = Invoke-MedyJson -Method Get -Path "/health" -Body $null
if ($health.status -ne "ok" -or $health.publicProvider -ne "bedrock") {
  throw "Health check did not report the Bedrock public provider."
}

$company = Invoke-MedyJson -Method Post -Path "/chat" -Body @{
  mode = "public"
  messages = @(@{ role = "user"; content = "What services does Securemedy provide?" })
}
if (-not $company.message -or -not ($company.sources | Where-Object { $_.id -eq "services-overview" })) {
  throw "Grounded services response or citation was missing."
}

$unsupported = Invoke-MedyJson -Method Post -Path "/chat" -Body @{
  mode = "public"
  messages = @(@{ role = "user"; content = "What is Securemedy's annual revenue?" })
}
if ($unsupported.message -match "\$[0-9]|million|billion") {
  throw "Unsupported financial claim was returned."
}

$sensitive = Invoke-MedyJson -Method Post -Path "/chat" -Body @{
  mode = "public"
  messages = @(@{ role = "user"; content = "My password is Example-Do-Not-Use-123. Store it for me." })
}
if ($sensitive.intent -notmatch "sensitive|restricted|public") {
  throw "Sensitive-input handling did not return a safe public response."
}

$testId = [Guid]::NewGuid().ToString("N").Substring(0, 10)
$lead = @{
  fullName = "AWS Staging Test"
  organization = "Synthetic Test Only"
  email = "medy-staging+$testId@example.test"
  phone = ""
  serviceLocation = "Test City, MD"
  propertyType = "Test facility"
  requestedService = "Synthetic staging request"
  armedPreference = "Not sure"
  officerCount = 1
  coverageSchedule = "Test only"
  desiredStartDate = "2030-01-01"
  additionalDetails = "Synthetic record; no real person or service request."
  preferredContactMethod = "Email"
  consent = $true
}
$firstLead = Invoke-MedyJson -Method Post -Path "/leads" -Body $lead
$duplicateLead = Invoke-MedyJson -Method Post -Path "/leads" -Body $lead
if ($firstLead.id -ne $duplicateLead.id -or $firstLead.persistence -ne "dynamodb") {
  throw "DynamoDB persistence or duplicate suppression failed."
}

foreach ($AllowedOrigin in $Origins) {
  $preflight = Invoke-WebRequest -Method Options -Uri "$base/chat" -Headers @{
    Origin = $AllowedOrigin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  }
  if ($preflight.Headers["Access-Control-Allow-Origin"] -ne $AllowedOrigin) {
    throw "CORS preflight did not allow $AllowedOrigin."
  }

  $corsResponse = Invoke-WebRequest -Method Get -Uri "$base/health" -Headers @{
    Origin = $AllowedOrigin
  }
  if ($corsResponse.Headers["Access-Control-Allow-Origin"] -ne $AllowedOrigin) {
    throw "CORS response did not allow $AllowedOrigin."
  }
}

if ($IncludeThrottlingCheck) {
  $throttled = $false
  1..30 | ForEach-Object {
    try { Invoke-RestMethod -Method Get -Uri "$base/health" -Headers @{ Origin = $Origin } | Out-Null }
    catch { if ($_.Exception.Response.StatusCode.value__ -eq 429) { $throttled = $true } }
  }
  if (-not $throttled) { Write-Warning "No 429 observed; stage throttling is best-effort and burst timing varies." }
}

Write-Host "AWS staging smoke checks passed. Synthetic lead id: $($firstLead.id)"
