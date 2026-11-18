# AWS public chatbot deployment

This stack migrates only the public Securemedy chatbot. Render remains unchanged, and the employee/demo assistant is neither enabled nor exposed by the Lambda configuration.

## Prerequisites and configuration

- Node.js 22, AWS CLI v2, AWS SAM CLI, and Docker.
- An authorized AWS account in `us-east-1` where `amazon.nova-micro-v1:0` is available. Catalog presence alone does not prove invocation permission.
- Deployment permissions for CloudFormation/SAM, S3 artifacts, Lambda, API Gateway v2, IAM create/update/delete-role and pass-role, DynamoDB, Logs, CloudWatch, X-Ray, Budgets when enabled, and read-only Bedrock validation.
- ARM64 is selected because runtime dependencies are JavaScript-only. Reassess if a native dependency is added.

SAM sets `AI_PROVIDER=bedrock`, `MEDY_PRODUCTION_AI=true`, `MEDY_AWS_PRODUCTION=true`, `BEDROCK_MODEL_ID`, `AWS_REGION`, `CLIENT_ORIGIN`, `MEDY_LEADS_TABLE`, `MEDY_LEAD_RETENTION_DAYS`, and `MEDY_METRICS=true`. Optional AI bounds remain supported: `AI_MAX_INPUT_LENGTH`, `AI_HISTORY_MESSAGES`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS`, `AI_TEMPERATURE`, `AI_DAILY_TOKEN_BUDGET`, and `AI_RATE_LIMIT_PER_MINUTE`.

`CLIENT_ORIGIN` is a comma-separated exact allowlist and is mandatory in AWS production. CORS is not authentication. API Gateway stage throttling is the distributed first line of abuse control; Express limits are secondary per-instance protection. WAF is intentionally omitted from this low-fixed-cost stack and can be added if observed abuse warrants it.

## Local verification and staging command

Run from the repository root:

```powershell
npm ci
npm test
npm run lint
npm run typecheck
npm run build
sam validate --lint --template-file template.yaml
sam build --use-container --template-file template.yaml
sam deploy --guided --region us-east-1 --stack-name medy-public-chatbot-staging `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides `
  AllowedOrigins=https://new.securemedy.com,https://www.securemedy.com `
  BedrockModelId=amazon.nova-micro-v1:0 LeadRetentionDays=30 `
  ReservedConcurrency=3 LogRetentionDays=14 `
  MonthlyBudgetUsd=5 `
  BudgetAlertEmailPrimary=program.specialist@securemedy.com `
  BudgetAlertEmailSecondary=uniform.equipment@securemedy.com
```

The deploy command is an approval-gated example, not authorization to run it. Both confirmed exact HTTPS origins are retained for staging and production rollout; wildcard CORS is not permitted. SAM's esbuild workflow excludes host `node_modules`, installs from the workspace lockfile in Linux, and bundles the handler, shared code, runtime dependencies, and approved editorial knowledge.

After an approved staging deployment, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-aws-staging.ps1 `
  -ApiBaseUrl "https://API_ID.execute-api.us-east-1.amazonaws.com/api" `
  -Origins "https://new.securemedy.com","https://www.securemedy.com" `
  -IncludeThrottlingCheck
```

The suite covers provider health, approved knowledge, unsupported claims, sensitive input, synthetic lead creation and duplicate suppression, CORS, and optional throttling. It uses reserved `example.test` contact data; never substitute real personal data.

## Data, diagnostics, and safety

AWS production uses an encrypted on-demand DynamoDB table. An atomic deterministic key suppresses the same contact/service submission within one UTC day across Lambda instances. A submission around a UTC-day boundary can create two records. Records have a configurable TTL (30 days by default, maximum 90), but TTL deletion is asynchronous and expired items can remain for days. There is no public list route and the runtime role cannot scan the table.

Logs contain allowlisted metadata only: request ID, known route, status, latency, provider/model, token counts, and safe failure category. Messages, model output, headers, query strings, and contacts are not logged. The template sets finite retention and creates Lambda error, throttle, and high-duration alarms. Alarm actions are intentionally not provisioned; attach an authorized notification destination after deployment. Do not enable payload execution logging.

The separate Medy budget is scoped conservatively to Bedrock, Lambda, API Gateway, DynamoDB, CloudWatch, and S3 service charges and sends actual-spend and forecast alerts at 80% to both Securemedy recipients. This captures Medy's primary token cost but can overcount unrelated future workloads that use the same services. Each recipient must verify its address for this AWS account before notifications become active. Budgets are alerts, not hard caps. Provider token counters are in-memory estimates: Lambda instances do not share them, cold starts reset them, and concurrent calls can pass them. Use budgets, API throttling, monitoring, and service quotas for operational cost control.

## Authorization and release checklist

### Before AWS access

- Confirm authorization to use account `164213622111`; record its owner, billing owner, retention owner, and alert recipient.
- With approval, authenticate using `aws login` or an approved named profile. Verify `aws sts get-caller-identity` and region `us-east-1` without recording credentials.
- Read-only inspect the model catalog, quotas, existing stack/API/Lambda/table names, and budget-name collisions.
- Obtain separate approval for a paid synthetic Bedrock Converse invocation. Confirm whether the account can invoke the direct model ID or requires an inference profile; the latter needs a different least-privilege ARN.
- Confirm the two website origins, CSP owner, Render rollback endpoint, retention, stack name, and budget recipient.

### Deploy and verify staging

- Review the CloudFormation change set. Expected resources are an HTTP API/stage/routes, Lambda and execution role/permissions, finite-retention log groups, an encrypted on-demand DynamoDB table with TTL, three CloudWatch alarms, an optional Budget, and SAM deployment artifacts in S3. Active X-Ray tracing is intentionally disabled for the initial low-cost launch; structured logs and alarms provide the required operational signals.
- Deploy only with explicit approval and use the staging stack name first.
- Verify runtime/architecture/timeout/concurrency, API payload format and throttle, TTL/SSE, runtime IAM resources, and log retention.
- Run the synthetic smoke suite. Verify employee/demo/admin routes return 404 and a forced Bedrock failure returns only a safe deterministic response, never an OpenAI call.
- Observe privacy-safe diagnostics, alarms, throttles, latency, and cost during a soak period.
- Keep staging for no longer than 24 hours and preferably delete it immediately after successful smoke tests. Never place its URL on a public page or use real customer data.

Read-only monitoring commands during the approved staging window:

```powershell
aws cloudformation describe-stacks --region us-east-1 --stack-name medy-public-chatbot-staging
aws lambda get-function-concurrency --region us-east-1 --function-name FUNCTION_NAME
aws cloudwatch describe-alarms --region us-east-1 --alarm-name-prefix medy-public-chatbot-staging
aws logs tail LOG_GROUP_NAME --region us-east-1 --since 30m --format short
aws budgets describe-budget --account-id 164213622111 --budget-name medy-public-chatbot-staging-monthly
```

Before deleting staging, record the `LeadsTableName` stack output and the exact packaged Lambda S3 bucket/key from the deployed template. Cleanup remains a separate approval-gated operation:

```powershell
$StagingTable = aws cloudformation describe-stacks --region us-east-1 `
  --stack-name medy-public-chatbot-staging `
  --query "Stacks[0].Outputs[?OutputKey=='LeadsTableName'].OutputValue" --output text

sam delete --region us-east-1 --stack-name medy-public-chatbot-staging --no-prompts

# The table is intentionally retained. Confirm it contains synthetic staging data only,
# then obtain privacy-owner approval before running:
aws dynamodb delete-table --region us-east-1 --table-name $StagingTable

# Delete only the recorded staging artifact object after approval; never empty or delete
# a shared SAM-managed bucket blindly.
aws s3api delete-object --bucket RECORDED_SAM_BUCKET --key RECORDED_STAGING_OBJECT_KEY
```

After cleanup, verify the stack and staging API no longer exist, the retained table was handled according to privacy approval, the Medy staging budget was removed with the stack, and the production Render endpoint is still healthy.

### Cut over and monitor

- Obtain separate approval for website CSP and endpoint changes. Before changing the endpoint, add the exact deployed API origin (for example, `https://API_ID.execute-api.us-east-1.amazonaws.com`) to `connect-src` on both `https://new.securemedy.com` and `https://www.securemedy.com`.
- Change only the widget `api-url` to the stack `ApiUrl` plus `/api`. Keep the existing widget script and UX.
- Preserve `https://medy-ai-assistant-demo.onrender.com/api` for immediate rollback. The script can remain `https://medy-ai-assistant-demo.onrender.com/medy-widget.js?v=1`.
- Immediately repeat public health/chat/CORS checks and monitor both AWS and Render. Do not disable Render during migration.

### Roll back

- Restore the saved Render `api-url`, then verify Render health and representative public chat.
- Leave AWS intact for diagnosis unless deletion receives separate approval.
- If deletion is approved, run `sam delete --region us-east-1 --stack-name medy-public-chatbot-staging`. The table is retained by policy; export or deletion requires privacy-owner approval.

## Costs and IAM handoff

There is no VPC or NAT gateway. Variable charges are Nova Micro tokens, HTTP API calls, Lambda duration, DynamoDB requests/storage, logs, and transfer. The three standard alarms currently fit within the account's CloudWatch free allowance; if that account-wide allowance is later exhausted, standard alarm pricing applies. Monitoring-only AWS Budgets are free. WAF and active X-Ray tracing are omitted initially to minimize fixed/telemetry cost. Before deployment, forecast using expected chats and measured token distributions in the AWS Pricing Calculator. The proposed `$5` budget is only an alert threshold.

Generate and review a narrowly scoped deployment policy against the finalized template. Do not reuse the runtime policy for deployment. The runtime role remains restricted to `bedrock:InvokeModel` for the selected model and `dynamodb:PutItem/GetItem` for the created table, plus SAM-managed logging/tracing.

## GitHub handoff

- Commit source, lockfile, SAM template, tests, smoke script, and this document in logical groups. Never commit `.env*`, credentials, lead exports, or `.aws-sam` artifacts.
- Require test, lint, typecheck, build, and SAM validation checks. Prefer GitHub OIDC and a scoped deployment role over long-lived keys.
- Record account owner, region, stack, model ID, origins, retention/budget owners, and rollback endpoint.
- Repository transfer, pushes, secrets, environments, CODEOWNERS, and branch protection changes each require explicit approval.
