param(
  [Parameter(Mandatory = $true)][string]$ChangeSetArn,
  [string]$StackName = "medy-public-chatbot-staging",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$response = aws cloudformation get-template `
  --region $Region `
  --profile default `
  --stack-name $StackName `
  --change-set-name $ChangeSetArn `
  --template-stage Processed `
  --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not read processed change-set template." }

$cors = $response.TemplateBody.Resources.PublicApi.Properties.Body."x-amazon-apigateway-cors"
if ($null -eq $cors) { throw "Processed API definition has no CORS object." }

$expectedOrigins = @(
  "https://securemedy.com",
  "https://www.securemedy.com",
  "https://new.securemedy.com"
)
$expectedMethods = @("GET", "POST", "OPTIONS")
$expectedHeaders = @("content-type", "x-request-id")

function Assert-ExactSet {
  param([object[]]$Actual, [string[]]$Expected, [string]$Label)
  $actualValues = @($Actual | ForEach-Object { [string]$_ } | Sort-Object -Unique)
  $expectedValues = @($Expected | Sort-Object -Unique)
  if (($actualValues -join "|") -ne ($expectedValues -join "|")) {
    throw "$Label mismatch. Actual: $($actualValues -join ', ')"
  }
}

Assert-ExactSet -Actual $cors.allowOrigins -Expected $expectedOrigins -Label "CORS origins"
Assert-ExactSet -Actual $cors.allowMethods -Expected $expectedMethods -Label "CORS methods"
Assert-ExactSet -Actual $cors.allowHeaders -Expected $expectedHeaders -Label "CORS headers"
if ([int]$cors.maxAge -ne 600) { throw "CORS maxAge must be 600." }

Write-Output "Processed API CORS contract passed."
