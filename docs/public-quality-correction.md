> Historical report/workflow: the owner-authorized official-website refresh policy and current inventory are documented in [Public v1 final update](public-v1-final.md). Its first-party approval policy supersedes earlier manual-approval requirements; production activation remains restricted.

# Public Medy quality correction — 2026-10-19

Local implementation complete; real-model acceptance remains pending. No deployment approval is implied.

## Root causes and changes

1. Both Express and OpenAIProvider called conflictBoundary before model inference. A commercial request mentioning the founder could receive a canned founder disclaimer and never reach OpenAI. Express now leaves factual conflict interpretation to the configured OpenAI provider. The provider receives the unresolved fact categories and uncertainty descriptions, while approved-only retrieval remains enforced. Emergency, sensitive-data and contact-consent boundaries still run before inference. The deterministic fallback retains its conservative conflict routing when OpenAI is absent; it does not provide equivalent natural-language quality.
2. Retrieval combined the latest question and old user topics into one equally weighted query, including the latest turn twice. It now orders latest-turn matches first, then up to three historical matches for short follow-ups, then verified contact/Careers/employee-routing entries. Small shared vocabulary normalizations cover leadership roles, licensing, M3dyHub and unpaid-payroll wording. These affect retrieval only, not answer selection or business actions.
3. The prompt prohibited gathering lead details in chat and permitted only a narrow set of requirements. It now distinguishes non-sensitive assignment requirements from contact information. One useful follow-up at a time can gather location, property, concern, officer type/count, schedule, start and duration. Explicit handoff/quote requests and qualified opportunities can offer the inert consent form; no generated text can write a lead or notify anyone.
4. Citations automatically produced navigation buttons. Empty citations also produced a generic Contact button, and a keyword regex offered forms irrespective of conversational intent. Citation selection and navigation are now separate model fields. Server-authored navigation uses only retrieved approved records. The form is offered only through a validated boolean, never by executing model actions. Greetings and language changes need no sources or contact actions.
5. The clients displayed multiple sources for the same URL and displayed that URL again as navigation. A shared presentation function now shows one navigation control per destination and one citation per remaining destination. An explicitly requested navigation button takes precedence over a duplicate citation link. The API still retains source record provenance. React uses this through ApiClient; the standalone widget applies the same helper.
6. The widget dropped failed user requests from conversation history. It now retains the unanswered user turn without inventing an assistant answer. Both clients display failure explicitly. Follow-up recovery can therefore refer to the unanswered language request.
7. JSON mode did not constrain the returned schema. The same configured model now receives strict JSON Schema output with retrieved IDs enumerated for citations/navigation. Local validation remains in place. Output refusal, truncation, invalid schema, unknown sources and unsupported claims have distinct content-free diagnostic categories, alongside existing authentication/billing/network/timeout categories. No retries or budget increases were added. See [official OpenAI structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat): constrained output improves format reliability; it does not prove factual correctness.

## Knowledge audit and approval gaps

The editorial store was inspected directly: its 22 raw source records contain extracted page text, not just titles/URLs. Retrieval sends approved answer text and uncertainty, never the raw unreviewed crawl or research seed. All 17 currently approved records remain approved; no facts were self-approved or changed in the store.

| Topic | Available to public model | Remaining limitation |
| --- | --- | --- |
| About/history | Substantive company overview and motto | Conflicting founding dates remain quarantined |
| Leadership/founder/owner | Link-only leadership guidance is explicitly treated as routing, not evidence of identities | Raw About text names a Chairman and describes establishing the company, but publication approval is missing; Chairman does not establish legal ownership |
| Physical/electronic security | Approved service descriptions including officers, patrol, CCTV, access control and alarms | Location-specific licensing, staffing and availability need confirmation |
| Risk/emergency management | Approved assessments, threat analysis, continuity, exercises and recovery descriptions | No dispatch capability or urgent-response promises |
| Industries | Approved government, commercial, healthcare, education, retail, industrial/logistics and other listed environments | Suitability depends on engagement |
| Careers | Official page and application guidance | No approved live vacancies, wages or application-status facts |
| Employee routing | Official employee portal and bounded public guidance | No access to records; no separate internal M3dyHub assistant built |
| Payroll/HR | Portal for current employees; verified general contact can be asked to route former employees | No verified departmental email, phone, wage-resolution policy or resolution deadline |
| Contact | Approved general phone/email and Contact page | Conflicting address remains under review |
| Coverage/licensing | Uncertainty context and business inquiry route | Historical state counts and dated license listings do not establish current authority |

Corrected retrieval gaps include founder/owner/Chairman-to-leadership, M3dyHub-to-portal and unpaid-wages-to-employee guidance. The regression cases assert substantive approved knowledge reaches the model, and that a leadership disclaimer does not intercept commercial requests. The 11 existing conflict queues, approval states, provenance and source histories remain unchanged. Approve founder attribution separately from ownership after reviewing the exact evidence; do not approve an entire leadership biography merely to publish one role.

## Yoruba investigation

No supplied request-correlated failure log or upstream response establishes the historical cause of “How about Yoruba?”. Unicode/diacritics survive request construction, JSON parsing, validation and widget display in the new tests. The phrase is not intercepted by deterministic routing when OpenAI is active. Timeout, truncated output, schema failures and provider refusals are independently tested and safely classified. The original failure remains undiagnosed rather than being attributed to language support without evidence. Requested-language continuation is now explicit, but real Yoruba fluency and actual provider success remain unverified.

## Files changed in this correction

- apps/api/src/app.ts — prevent factual conflict rules from preempting OpenAI.
- apps/api/src/openai-provider.ts — context priority, consultative/public routing instructions, structured output, separate citations/navigation, handoff behavior and safe diagnostics.
- apps/api/src/knowledge-store.ts — shared retrieval vocabulary normalization.
- apps/api/src/public-policy.ts — sensitive facility-plan plural handling.
- packages/shared-types/src/index.ts — shared destination deduplication.
- packages/assistant-core/src/index.ts — apply presentation normalization for React.
- packages/assistant-widget/src/medy-assistant.ts — deduplicate rendering and preserve unanswered turns.
- apps/api/src/openai-provider.test.ts; apps/api/src/conversation-evaluation.test.ts; knowledge/editorial/conversation-evaluation.json — update provider contract expectations.
- apps/api/src/public-quality.test.ts; knowledge/editorial/quality-regression.json — twenty requested scenarios plus retrieval, API handoff and output-failure tests.
- packages/assistant-widget/src/medy-assistant.test.ts; tests/e2e/demo.spec.ts — UI duplication and recovery regressions.
- docs/public-quality-correction.md; docs/evidence/quality-correction-results.json — report and check evidence.

Generated ignored dist files were rebuilt, including assistant-react dist/index.js and index.d.ts. No dist file was manually edited. The existing working tree contains additional changes from earlier tasks; this list describes this correction only.

## Verification

- npm test: 188 tests across 10 files passed; mocked clients only.
- npm run test:e2e: 18 browser tests passed; local temporary data, no paid AI.
- npm run build: passed (required execution outside restricted sandbox for esbuild directory resolution).
- npm run typecheck: passed using equivalent tsc -b.
- npm run lint: passed; existing module-type warning only.
- Changed-file Prettier checks and git diff --check: passed. Repository-wide formatting still has the previously documented untouched-file baseline; it was not mass-reformatted.
- npm run dev:openai: passed and reused verified Medy API PID 28184 and Vite PID 3464 at verification time. No unrelated process was terminated.
- GET http://127.0.0.1:4180/api/health: HTTP 200, publicProvider=openai, systemCA=true.
- GET http://127.0.0.1:5180/ and /wordpress-host.html: HTTP 200.

The twenty scenarios cover the supplied quoted prompts and scenario descriptions. No separate verbatim conversation transcript accompanied this request; the fixture is not represented as one. Scripted model answers test transport, routing, approved context, citations, handoff and UI behavior. They cannot establish actual model comprehension, factual entailment, commercial effectiveness or translation quality.

## Manual acceptance

1. Keep the existing local .env.local configuration and secrets private. Start with npm run dev:openai. Open http://127.0.0.1:5180/ and http://127.0.0.1:5180/wordpress-host.html. Health selection alone does not make a paid call or verify billing.
2. After explicit authorization for paid manual testing, use the unchanged configured model and existing budgets. Start a fresh chat and follow the twenty cases in knowledge/editorial/quality-regression.json. The stored replies are examples, not exact-output requirements.
3. For the warehouse thread, give New York, existing cameras, two unarmed officers, nights and next month. Correct the visitor role and schedule. Require one relevant next question, no repeated supplied details, and no guarantee of licensing/staffing. Switch to Careers, then back to the assignment.
4. Ask about a big contract for the founder/chief. Require acknowledgement of the commercial objective and an optional consent-form handoff, with no executive meeting promise and no invented attribution. A chat response must not create a lead or send email.
5. Ask about jobs casually, pay ranges, M3dyHub, unpaid wages and HR as a former employee. Verify official links, no invented departmental contacts or wage ranges, and no request for identity/payroll/bank documents.
6. Request Spanish, then Yoruba. A fluent reviewer should assess the translation. If a request fails, inspect only the ai_failure reason/status (never paste private logs or secrets), then ask to retry. The failed question must not be treated as answered. Do not raise token limits or retry automatically.
7. Check every displayed citation against the actual answer and approved excerpt. Greetings/language-only replies should have none. One destination should appear once per reply. Navigation alone does not prove a leadership fact.
8. Test a mock form with explicit consent only. Acknowledgement must say local simulation/no configured notification. Stop servers with npm run dev:stop when finished.

## Remaining production blockers

Owner approval for unresolved facts and verified HR routing; real-model acceptance (especially citations, unsupported assertions and Yoruba); confirmation the configured model/account supports strict structured output; production provider activation remains deliberately blocked. Existing per-process daily counters reset on restart and do not coordinate replicas, and local lead storage/notifications are not a production delivery system. Refer to public-release-proposal.md for the existing durable-storage, privacy, spend-control and deployment decisions. Semantic citation relevance is still a model judgment; schema membership checks alone cannot prove entailment. Public deterministic fallback remains intentionally limited.

No paid model requests, secret edits, model changes, spending-limit changes, commits, pushes, deployments or production changes were made.
