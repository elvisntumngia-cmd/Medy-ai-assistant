> Historical report/workflow: the owner-authorized official-website refresh policy and current inventory are documented in [Public v1 final update](public-v1-final.md). Its first-party approval policy supersedes earlier manual-approval requirements; production activation remains restricted.

# SecureMedy public assistant candidate — 2026-10-19

## Status

Engineering candidate implemented locally on the existing 43a4bf5 worktree, preserving the prior OpenAI integration and startup work. **Not approved for production activation.** OpenAI remains explicitly local-only, no production environment was edited, and no commit, push, deployment, paid model request, database provisioning or outbound integration was performed.

Owner acceptance, disputed facts, live model/billing access and the production-activation proposal remain gated. Unknown facts are suppressed rather than guessed.

## Baseline and migration

Baseline: 96 tests passed; full dependency audit reported 18 affected development packages (4 critical, 13 high, 1 moderate), production-only zero.

| Concern | Existing path | Candidate change |
|---|---|---|
| Public WordPress/demo | assistant-widget; demo uses custom element | Retained bundle/API contracts; source links, reset, inactivity window, accessible errors and consent safeguards |
| React employee demo | assistant-react and assistant-core | Preserved fictional routes; source URLs and optional form callback; no real employee retrieval |
| HTTP | apps/api/src/app.ts | Origin enforcement, public action/citation filtering, local-only fictional demo gate, minimized lead acknowledgments |
| AI | AIProvider / OpenAIProvider / BedrockAIProvider | Interfaces retained; approved lexical retrieval, bounded context, conflict/safety boundaries; no new production activation |
| Public facts | public-knowledge.ts compiled array | Migrated to schema-validated editorial JSON with live accessors; withdrawals take effect without rebuild |
| Employee knowledge | knowledge/employee | Never crawled, indexed or read by the candidate runtime; existing local UI uses synthetic demonstration context |
| Leads | /api/leads → LocalLeadProvider | Explicit form/consent retained; atomic writes, locking, deduplication, expiry, corruption failure, minimized response |
| Other lead scaffold | lead-workflow.ts | Retained and tested; public chat does not instantiate it or connect a pool |
| Dev processes | scripts/dev.ps1 | Existing npm run dev:openai retained; fixed ports 4180/5180 and ownership checks |
| Deployment | server.ts / built demo + widget | No deployment performed; existing SPA/widget artifact routing retained |

The smallest viable architecture is a local, versioned JSON editorial store plus an atomic single-writer CLI and lexical ranking. No embeddings, vector database, web search tool in chat, fine-tuning or new AWS resources were added. The crawler's parse5 parser was already transitive; it is now an explicit production dependency.

Security maintenance removed unused concurrently, updated Vitest from 3.2.7 to 4.1.12 to remove vulnerable test infrastructure, and applied compatible npm audit fix patches **without --force**. See the [Vitest migration guidance](https://v4.vitest.dev/guide/migration.html). Frameworks and production provider model defaults were preserved. Independent final full and production audits both report zero advisories; JSON evidence is in docs/audit-*-2026-10-19.json. Advisory absence is not a penetration-test guarantee.

## Editorial knowledge and crawl evidence

The inventory retains **17 approved conservative legacy summaries**, **33 needs-review entry records** (31 research bullets plus two quarantined legacy assertions), and **11 open conflict queues**. New crawled sources are research only. See [source manifest and inventory](source-manifest.md).

The bounded initial crawl visited 24 pages using 34 requests, discovered sitemaps and same-site links, and left a bounded queue for future runs. A two-page follow-up used 12 requests to complete contact/home evidence. The final store contains 22 extracted source records and 24 checked destinations. One WordPress sample post was excluded as boilerplate. Not all discoverable pages were crawled.

Crawling is GET-only, HTTPS-only and limited to securemedy.ng / securemedy.com and their www aliases. It respects robots policy, crawl delay, 429/503 host deferral, redirect revalidation and per-host pacing. It bounds DNS, request duration, content size, page/request counts, sitemap recursion and extracted text. DNS answers must be public and are pinned to the actual TLS request; IP literals, private addresses, credentials, alternate ports, query traps, login/admin/applicant routes and non-HTML downloads are excluded. Scripts never execute. Forms, navigation, embeds, comments and common author/byline metadata are removed.

Approved navigation is checked against recent successful public fetches. The existing employee portal is the sole routing-only exception: it remains the preapproved destination, is never crawled, and needs owner browser verification. No active vacancy or live application claim is inferred from Careers content. No third-party LinkedIn or regulator page was crawled; supplied citations remain unverified research evidence.

Open conflict categories: founding year, state coverage, address, Nigeria Limited/entity metadata, founder, current owner, vacancies, licenses, certifications/endorsements, case studies/contracts, testimonials. Resolving a queue is a human action with recorded evidence; it does not approve a fact automatically.

## Conversation and business safety

Only approved, public, unexpired, unblocked answer records enter the model context. Raw crawls, research bullets and version history do not. User and assistant history are untrusted. The prompt distinguishes education from company commitments, answers first, asks at most one useful follow-up, remembers corrections/equipment/role changes, and avoids repeated introductions and automatic sales handoff.

The provider returns text, approved source IDs and an optional inert form suggestion; server code owns navigation and strips business-action data. Unsupported action-delivery and price assertions are rejected. Emergency, credential and conflict boundaries run before inference. Contact text is intercepted in the widget, routed to consent on the server, and redacted from older model-history turns. Pattern redaction cannot guarantee arbitrary free text contains no sensitive data; visitors are warned not to share it.

The form transmits only on explicit submission with consent=true. Only the chosen email/phone channel is required; organization is optional. Persisted records receive UUIDs, 24-hour duplicate suppression and a configurable 1–90 day retention interval (default 30). Expired new-format records are hidden on reads and pruned on the next save. Legacy records without an expiry are preserved for owner-reviewed migration. Storage is atomic/locked; corrupt storage returns failure and is not overwritten.

Acknowledgments confirm storage only. There is no email/SMS/CRM dispatch, and the UI says so. In production, the file adapter requires an explicitly configured absolute MEDY_LEADS_FILE; mounting durable storage, backup/access controls and a deletion policy require owner operational review. The existing PostgreSQL scaffold is not a verified live public handoff.

## Reproducible local verification

Use Node 22.19+ or a supported Node 24 runtime for system CA support; this machine was verified on Node 24. Windows startup:

~~~powershell
npm ci
npm run dev:openai
npm run test:dev
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run knowledge -w @medy/api -- inventory
~~~

Open http://127.0.0.1:5180. Restart using npm run dev:openai -- -Restart; stop using npm run dev:stop. Keep credentials in the existing ignored root .env.local. Do not paste them into chat or put them in VITE_ variables. The API reads that local file through the development entry point. The production entry point does not.

The existing AI environment controls remain documented in .env.example and openai-local-development.md. Added settings:

| Setting | Default / behavior |
|---|---|
| MEDY_PUBLIC_KNOWLEDGE_FILE | Repository knowledge/editorial/store.json; use an absolute approved snapshot path for a reviewed release |
| MEDY_METRICS | false; true emits content-free route/status/duration/request-ID logs |
| MEDY_LEAD_RETENTION_DAYS | 30; integer 1–90 |
| MEDY_LEADS_FILE | Existing local path; production requires an explicit absolute durable path |
| CLIENT_ORIGIN | Approved exact browser origins; unapproved Origin requests receive 403 |

Tests use mocked OpenAI, deterministic browser servers and temporary data. The 13-case evaluation covers warehouse theft, existing cameras/loading dock, role correction, guards versus cameras, careers and back, founder/owner, conflicting address, specific-state license, vacancy, quote, emergency, page injection and short follow-up. The nine retrieval/context scenarios and four policy-boundary scenarios pass. This measures engineering contract/fixture recall, **not live model conversation quality**.

## Costs and operating limits

No new recurring infrastructure is required. Editorial review/crawling and lexical search run locally. At the configured gpt-4.1-mini rates of $0.40 per million input tokens and $1.60 output, a 1,500-input / 300-output turn is approximately **$0.00108**, or **$0.108 for 100 such turns**. These rates were checked against [official OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini); account availability still needs live verification. The current official model page also marks gpt-4.1-mini deprecated; the requested default is preserved and configurable, and any model change needs explicit review before production activation.

The server reserves a conservative UTF-8 byte-based input allowance plus framing and capped output before each request, including failures; no retry refunds occur. Defaults: 100 daily requests, 250,000 reserved tokens, 450 output tokens, 15-second timeout, 10 messages, 2,000 input characters, 10 AI requests/IP/minute. Conservative reservation often stops earlier than the nominal request budget. At those prices, 250,000 actual tokens all priced at the higher output rate would be $0.40, but this is **not an account-level spend guarantee**.

AI budgets and IP limits remain per-process memory, reset on restart and multiply across instances. They must not be represented as durable Render/account-wide ceilings. No public OpenAI activation is enabled, and the JSON editorial workflow is local/snapshot-oriented. Before approving a paid production provider, choose and approve either durable/shared accounting using existing infrastructure or a documented single-instance/reset limitation with provider-side spending controls. No service was provisioned for this.

## Operations, rollback and future internal boundary

See [editor instructions](public-editor-guide.md) and [release proposal](public-release-proposal.md). Metrics contain request ID, route class, status and latency; AI logs contain usage/cost/reservations and allowlisted failure categories, never prompts, contact details, headers, keys or upstream bodies. Operators should monitor 429 budget/rate events, 503 provider/output failures, response latency, storage failures and expiring knowledge. Request IDs support correlation without raw chat logging.

Rollback: stop local servers; retain a protected backup of the previous editorial snapshot; select AI_PROVIDER=deterministic; point the knowledge setting to the previous reviewed snapshot and restart. Knowledge withdrawal is immediate through the CLI. A future approved deployment should roll back the app/widget and knowledge snapshot together; never downgrade to a known vulnerable dependency lock or overwrite lead records.

The public repository adapter rejects namespace=internal regardless of any caller-supplied identity. Employee mode and fictional demo/admin APIs are unavailable in production/Render, even if DEMO_MODE=true. Public Bedrock testing remains an explicit local demo scaffold; its model-specific live integration is unverified. Future internal Medy requires a separate API/knowledge adapter with verified server-side SSO identity, role/tenant checks and document ACL filtering before retrieval, separate secrets/budgets/audits, and authenticated M3dyHub routing. Public messages cannot select that adapter. No SharePoint/HR connection or employee indexing was added.

## Final check results

- 160 unit/integration tests passed in nine files, including all 13 mocked conversation fixtures.
- All 17 browser tests passed, including independent WordPress host, mobile contact protection and mocked AI citations.
- Lint, typecheck, full build, startup safety and git diff --check passed. Existing module-type and React Router directive warnings remain informational.
- Full and production dependency audits: zero advisories.
- npm run dev:openai reuses verified local servers on 4180/5180; health reports OpenAI. No chat request was sent.
- Repository-wide format:check still reports seven untouched preexisting files; all changed TypeScript files were formatted. The malformed quoting in the root format scripts was corrected.
- Paid model calls during this task: zero.

Machine-readable evidence: docs/evidence/check-results.json. OpenAI/provider credentials, billing, actual model quality, employee portal availability and actual WordPress host CSP remain owner acceptance checks. No production-readiness claim is made.
