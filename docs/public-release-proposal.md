> Historical report/workflow: the owner-authorized official-website refresh policy and current inventory are documented in [Public v1 final update](public-v1-final.md). Its first-party approval policy supersedes earlier manual-approval requirements; production activation remains restricted.

# Production activation proposal — requires explicit approval

**Proposal only. Nothing here authorizes a deployment, secret change, paid call, or removal of local-only AI safeguards.**

The public artifact currently remains deterministic in production. OpenAI is rejected on Render/NODE_ENV=production; the local npm run dev:openai workflow is preserved. The Bedrock interface/scaffold remains for explicit local demo testing, with no verified live AWS integration. Production employee/demo modes are unavailable.

## Proposed minimum release

1. Owner accepts the public conversation evaluation and the 17 retained conservative legacy summaries. Approve evidence-backed corrections or explicitly accept suppression of the 11 conflict categories; do not silently publish the research seed.
2. Authorize a separately bounded live model evaluation using the locally configured key. The official model catalog currently marks the preserved gpt-4.1-mini default deprecated; approve a model/availability decision before activation. Confirm account/model availability, billing, response quality, source fidelity, injections, corrections, topic switching and no false delivery promises. This implementation made zero paid calls.
3. Approve a production-provider change separately. Its review must name model, allowed environment, server secret source, trusted proxy/IP configuration, CORS origins, timeout, output cap, daily spend control, instance count and failure behavior. Do not simply set OpenAI variables on Render: the code guard deliberately rejects that.
4. Approve durable lead storage using existing organization-controlled infrastructure or an explicitly mounted protected file. The default local JSON file on an ephemeral Render filesystem is not durable. Require backup/restore/deletion ownership and access controls; no database, disk subscription, CRM, email/SMS provider or new AWS resource has been provisioned.
5. Decide whether an acknowledged stored lead without outbound notification is an acceptable launch behavior. Current UI says no email or dispatch occurred. Do not promise callbacks/response times without an approved live operational workflow.
6. Approve privacy, consent and retention wording; check actual WordPress CSP and mobile/keyboard behavior. The employee portal must be manually verified; it is an approved routing-only exception, never crawled.

## Deployment checklist after approval

- Review the complete uncommitted diff, lockfile and source provenance. Obtain human approval before committing or pushing.
- Use supported Node and npm ci; run npm test, npm run test:dev, npm run lint, npm run typecheck, npm run build and npm run test:e2e.
- Run independent full and production dependency audits. Re-check model availability/prices and approved source expiry.
- Export and validate a minimal approved-only runtime snapshot. Ship API build, demo build, standalone medy-widget.js artifact and that snapshot together. Do not ship .env files, raw lead files, local logs or employee documents.
- Keep DEMO_MODE=false. Do not expose fictional sessions or admin endpoints. Use exact approved CLIENT_ORIGIN values; configure only a reviewed trusted proxy chain.
- Configure secrets only through an approved server-side secret mechanism; never VITE_ or widget attributes. No production secret change is part of this work.
- Confirm durable storage, no-PII logs, metric retention and incident ownership. Logs can expose public route class, request ID, status, latency, token use and allowlisted failures.
- Approve durable/shared budget accounting or explicitly accept the process-memory reset/multi-instance limitations with provider-side spend controls. Without that decision, production AI activation stays blocked.
- Deploy only after explicit approval; smoke-test approved public navigation, consent and storage using non-sensitive test data. Do not transmit real visitor data during acceptance.
- Roll back app/widget/snapshot as one reviewed release; choose deterministic mode when necessary. Preserve lead records and current security patches.

## Monitoring acceptance

Define owners and alerts for provider/output 503s, repeated rate/budget 429s, elevated latency, persistent-storage failures, unexpected outbound requests, expiring facts/links and dependency advisories. MEDY_METRICS=true enables structured per-request timing/status without raw chat or contact content; AI usage/failure logs remain content-free. This is instrumentation, not a provisioned external monitoring service.

## Separate future internal Medy

Do not widen the public catalog to include internal files. A future M3dyHub integration needs a separate authenticated API/repository, server-validated SSO identity, role/tenant membership and per-document ACLs before retrieval, independent budgets/secrets and access audits, an explicit retention policy and denial tests. Public namespace queries can never select internal retrieval. The current local fictional employee fixture is not authentication and is not a production integration.
