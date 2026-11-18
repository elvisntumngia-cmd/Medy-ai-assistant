# Medy AWS migration checkpoint

## Safe current state

- Development is paused on 2026-11-18. The public Medy chatbot is live and working through Render/OpenAI on Securemedy's website. Do not change its endpoint, Render configuration, DNS, CSP, or website without separate production approval.
- `main` and `origin/main` point to `c89f818c18c5386f1646231792a0ab3e5a1fb864` (`fix: package editorial knowledge for Render`), the latest known working live commit.
- AWS target remains API Gateway HTTP API -> Node.js 22 ARM64 Lambda -> Amazon Bedrock Nova Micro, with DynamoDB for leads and persistent inference accounting. Employee/demo routes remain excluded from the public Lambda.

## AWS staging status and blocker

- Account `164213622111`, region `us-east-1`.
- The staging stack `medy-public-chatbot-staging` rolled back because the account concurrency quota was 10 and `ReservedConcurrentExecutions=3` would leave fewer than AWS's required 10 unreserved executions. The failed stack was deleted.
- A quota increase from 10 to 1000 is pending AWS Support. Do not bypass `ReservedConcurrentExecutions=3` and do not deploy until the increase is approved and verified.
- Retained table `medy-public-chatbot-staging-LeadsTable-1E8N0ED3Z6T08` is active, empty at last check, encrypted and pay-per-request. Do not modify or delete it without explicit approval.
- Preserve the shared SAM bucket `aws-sam-cli-managed-default-samclisourcebucket-rbxwmoolfdvz` and its deployment artifacts.

## Cost-control work preserved on this branch

- Exact, unique approved FAQ matches bypass paid inference; uncertain/non-exact matches continue through the existing model flow and normal response sanitization/citation validation.
- Bedrock input length, history count, output tokens, API Gateway throttling and application request rate are configurable. Nova Micro is allowlisted as the only Bedrock model.
- New `inference-accounting.ts` proposes transactional DynamoDB reservations before each paid call. It atomically reserves shared monthly estimated cost plus assistant-specific daily requests/tokens, counts in-flight requests, reconciles known usage and conservatively retains unknown-failure reservations.
- Public and future MedyHub counters are separately attributed. Target is `$10/month`: provisional `$4` Public, `$4` MedyHub and `$2` shared buffer. Metadata warnings occur at estimated `$6`/`$8`; new paid calls stop at estimated `$9`. This is an application estimate, not a guaranteed AWS billing cap.
- Metadata-only diagnostics include assistant ID, request/token counts, estimated micro-dollar cost, throttling and safe error category. No messages, model responses, contacts, headers, secrets or credentials are intentionally logged.
- Static FAQ responses remain available when paid inference reservations are rejected. Lead capture, CORS and public/employee isolation are unchanged.

## Proposed infrastructure (not deployed)

- New encrypted, on-demand `InferenceAccountingTable` with TTL and retained deletion policy.
- Lambda IAM additions scoped to that table: `dynamodb:TransactWriteItems` and `dynamodb:UpdateItem`.
- Existing lead table permissions remain separately scoped. No WAF, queue, cache, VPC, NAT, provisioned concurrency or paid recurring service was added.

## Changed files

- `apps/api/src/app.ts`
- `apps/api/src/aws-infrastructure.test.ts`
- `apps/api/src/bedrock-provider.test.ts`
- `apps/api/src/bedrock-provider.ts`
- `apps/api/src/cost-controls.test.ts` (new)
- `apps/api/src/inference-accounting.ts` (new)
- `apps/api/src/public-knowledge.ts`
- `docs/aws-public-chatbot.md`
- `template.yaml`
- `docs/MEDY-CHECKPOINT.md` (this checkpoint)

## Validation completed and pending

- Focused Vitest run passed: 4 files, 26 tests (`bedrock-provider`, `cost-controls`, `aws-infrastructure`, `cors`).
- Root TypeScript typecheck passed before final preservation.
- Targeted ESLint passed with only the existing module-type warning.
- Monorepo production build passed; approved knowledge packaging verified 267 records.
- `sam validate --lint --template-file template.yaml` passed.
- Linux-container ARM64 `sam build --use-container --template-file template.yaml` completed successfully during preservation.
- Full repository tests were intentionally not rerun. Previously known unrelated date-sensitive knowledge tests expected 18 approved entries while 17 were then unexpired; reassess rather than masking that failure.
- Before deployment, review DynamoDB transaction expressions and run focused tests/typecheck/build again from this committed state. No live DynamoDB integration or paid Bedrock call was performed for these changes.

## Resume order

```powershell
git switch medy/cost-controls-wip
git status --short
npm.cmd exec -- vitest run apps/api/src/bedrock-provider.test.ts apps/api/src/cost-controls.test.ts apps/api/src/aws-infrastructure.test.ts apps/api/src/cors.test.ts
npm.cmd run typecheck
npm.cmd run build
sam validate --lint --template-file template.yaml
sam build --use-container --template-file template.yaml
```

Then review the cost-control diff and processed SAM template. Verify the Lambda quota increase read-only. Only after explicit staging approval, create a new non-executing change set; inspect it before requesting execution approval.

## Approval boundaries

- No AWS deployment, resource creation/deletion, retained-table change, artifact-bucket change or paid Bedrock invocation without explicit approval.
- No production AWS deployment, Render change, Git merge to `main`, website/DNS/CSP change or endpoint cutover without separate explicit approval.
- Keep Render/OpenAI serving production until AWS staging passes synthetic validation and a separately approved cutover plan is executed.
