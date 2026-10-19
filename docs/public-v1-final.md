# Medy Public v1 — final knowledge and personality update

Status: ready for final live acceptance testing. Automated checks passed; this is not a production activation approval.

## Website knowledge

The business owner authorized customer-facing use of public securemedy.ng content on 2026-10-19. Refresh no longer requires an additional editorial approval for accurately extracted first-party content. Outside research remains separately reviewed and is not automatically approved.

39 official pages are indexed as 113 substantive text excerpts, plus 18 concise/routing records: 131 retrievable records total. Coverage includes About Us, Chairman/establishment attribution, CEO-address page, physical/electronic/personnel security, risk and emergency management, concierge and special events, industries, Careers and seven job-detail pages, Contact, privacy/terms, recruitment SMS guidance and educational articles. The bounded crawl fetched 40 HTML pages with 49 requests; a WordPress sample page was excluded from useful knowledge. One article fetch failed; its still-fresh earlier source record remains indexed. This is not an exhaustive crawl of every site URL.

The About Us page identifies **Olabanji O. Folayan as Chairman** and describes him as establishing Securemedy, Incorporated. Medy may report that published wording with a citation. It must not infer legal ownership or relabel Chairman as CEO merely because a page is called CEO Address. Historical dates/state counts, certifications, jobs and benefits are published claims; they do not guarantee current licensing, staffing, vacancies or contract terms. Existing conflicts and source histories remain preserved (13 open queues after this crawl), with uncertainty scoped to the affected facts rather than blocking unrelated questions.

Generated excerpts are tied to the exact source hash and text. Changed, expired, unapproved or altered evidence fails closed. Public website content is data, never instructions. Forms, login/account pages, comments, third-party embeds, WordPress examples and suspected prompt instructions stay outside the approved index. No private employee documents are loaded into public retrieval.

Refresh without editing prompts:

~~~powershell
npm run knowledge -w @medy/api -- refresh
npm run knowledge -w @medy/api -- inventory
~~~

The crawl is bounded and observes robots, DNS/public-host restrictions, redirects, timeouts, size limits and pacing. Re-run refresh to update core pages; extend the existing seed list for specific additional public pages if necessary. Raw research-only crawl remains available as the separate crawl command. Normal runtime export now includes the approved source evidence required to validate official excerpts, while excluding outside/unapproved research.

## Conversation behavior

Warm, approachable AI identity; casual greetings, contractions and light humor without repeated introductions or pretending to be a human employee. Direct answers take precedence over unnecessary questions. Service discovery asks one useful question at a time (occasionally two closely related questions), remembers details/corrections, and offers the consent-based form after understanding the opportunity or when requested. Employee payroll/HR matters use the official portal without inventing ticketing features or collecting sensitive documents. Spanish/Yoruba remain within the configured model’s capabilities; real translation quality needs live acceptance.

The existing architecture, model, dependencies, provider guards, public/internal separation, limits, consent and lead persistence rules are preserved. AI-generated text cannot write leads, send messages or promise an executive meeting. Navigation and citations remain separate and deduplicated.

## Verification

- 193 automated tests / 11 files passed; OpenAI clients mocked.
- 18 local browser tests passed, including standalone-host, mobile, lead consent, duplicate links and failure recovery.
- Production build, lint and typecheck passed. Existing informational React Router/module-type warnings remain.
- No paid API calls or secret edits. No new dependencies or model changes for this final update.
- Local startup remains npm run dev:openai; http://127.0.0.1:5180/ and the API on port 4180. Stop with npm run dev:stop.

## Final live acceptance and genuine release blockers

After explicit spending authorization, test the twenty cases in knowledge/editorial/quality-regression.json through both the demo and /wordpress-host.html. Check direct website-supported leadership answers, no legal-ownership inference, casual greetings, warehouse discovery and corrections, major-contract handoffs, employee portal guidance, citation entailment, Spanish/Yoruba and provider-failure recovery. Mocked tests prove pipeline behavior, not real-model comprehension or translation quality.

Remaining production decisions: deliberate provider activation (still locally restricted), real-model/factual/citation acceptance, durable lead delivery and notifications, deployment privacy review, and shared durable budgets if using multiple/restarted instances. Current memory budgets reset with a process and do not coordinate replicas. Website contradictions need clarification when a visitor needs a definitive current fact; they no longer require blanket manual approval to quote the website accurately.

This report supersedes earlier reports’ 17-record inventory and founder-approval blocker. Earlier evidence remains historical. The user separately authorized committing and pushing these changes; no deployment or production environment change is authorized.

## Official source manifest

| URL | Extracted characters | Retrieved (UTC) | SHA-256 |
| --- | ---: | --- | --- |
| https://securemedy.ng/about-us/ | 3688 | 2026-10-19T15:19:01.473Z | 4f0ea0401f3f9954a0761c352704608af056621ef01135469a1c2a9ff209537e |
| https://securemedy.ng/services/ | 2737 | 2026-10-19T15:19:02.717Z | 5d555fc3819cb40dee8a010ad454ee60a5f788a7818ea92b5d191284a86791ef |
| https://securemedy.ng/service/physical-security/ | 1363 | 2026-10-19T15:19:03.467Z | f061310491ecebfae4d60cb1340f684327ec5fc4c60efc92607e78cca4351b06 |
| https://securemedy.ng/service/electronic-security/ | 1277 | 2026-10-19T15:19:04.779Z | 2efd996ed500b307600409d5dde13674f8ecc300efd77775fec826202aee6857 |
| https://securemedy.ng/service/risk-management/ | 1433 | 2026-10-19T15:19:05.826Z | 63b71cb3b0ffd38356b38b18000a5e7db2e9955944e6d9cd2ae7c41384e6fd9a |
| https://securemedy.ng/service/personnel-security/ | 1277 | 2026-10-19T15:19:06.744Z | 981676189e3fef6eadf1e9afb726e7d4bbcf5a2a775bd09fd668a20944a445e8 |
| https://securemedy.ng/service/emergency-management/ | 1318 | 2026-10-19T15:19:07.772Z | 59fef3204e03d0db623f304f1ae2928273e7956b329768476a38c9016b1f665a |
| https://securemedy.ng/service/concierge-services/ | 1292 | 2026-10-19T15:19:08.746Z | 029aa3d118bcbc3d67826fab8dddf904ec69e59537844e073d1efed1fef75b67 |
| https://securemedy.ng/industries-served/ | 1962 | 2026-10-19T15:19:09.846Z | 6e39ab05c720b93b71f2cec01a3317290b4a8858546913d714e5d777d11c70c0 |
| https://securemedy.ng/careers/ | 2800 | 2026-10-19T15:19:10.758Z | b816f3e5b6026dfbd5d88f31233c19b907d97f7ae1e8bad4321401a8f5a87a25 |
| https://securemedy.ng/privacy-policy/ | 4130 | 2026-10-19T15:19:12.778Z | afeac1fd64fe2a1161fa46cf72de0cf1ec24d4577a55f41c7979f8907e63ad9a |
| https://securemedy.ng/terms/ | 6539 | 2026-10-19T15:19:13.812Z | d69712d72807c67c6acb242d2c6c1a14cc8f5114f79b981aa0cd7334c45b1d39 |
| https://securemedy.ng/how-to-choose-a-federal-security-contractor/ | 5323 | 2026-10-19T15:19:15.783Z | 78e001d14f599e4f93519c1ff7ce20b64bd9ce6702135bd2323471d072451c43 |
| https://securemedy.ng/sba-8a-certified-security-contractor/ | 4109 | 2026-10-19T15:19:16.811Z | f46709a38197c823901df9157e9ecb924dc94339f8ad9560742aeb35a166c645 |
| https://securemedy.ng/physical-security-vulnerability-assessment-guide/ | 5279 | 2026-10-19T15:19:17.840Z | 8e7bffc8272837220aa33d1b61f3fa994cc153aa8b118c95fa98bc25699a1969 |
| https://securemedy.ng/armed-security-guard-licensing-maryland-virginia-dc/ | 6104 | 2026-10-19T15:19:18.827Z | 61514d41c22bb28017ed59e06ce546b882f17695d4d1b9afeda6fef0dd98f2a5 |
| https://securemedy.ng/coop-planning-federal-agencies-guide/ | 6605 | 2026-10-19T15:19:19.833Z | 275ce77ee4e5d869bbcb81686f47af7b52e7854742c56e3fd37a32fbe74168ee |
| https://securemedy.ng/executive-protection-vs-bodyguard/ | 6592 | 2026-10-19T15:19:20.923Z | 497b8569c79a3f67e2724cd79a6089680dab778f202aa70d58653c5d429fea27 |
| https://securemedy.ng/cleared-security-personnel-federal-contracts/ | 6891 | 2026-10-19T13:39:31.918Z | 94a7d91006ee10a132d122086066249b114be0e473d25e0002cf56e9e1be4b84 |
| https://securemedy.ng/contact/ | 254 | 2026-10-19T15:19:11.777Z | c9201142545a6391eaf9d9f8ee5af27772effd0089885c46b07e0da17533904b |
| https://securemedy.ng/ | 14522 | 2026-10-19T15:19:01.074Z | 3239e66328ee6c905ebcec0582eed5aca66fda2dff589b13433b965ce7d3f57a |
| https://securemedy.ng/blog/ | 3754 | 2026-10-19T15:19:14.807Z | 554b7fa14461388c4bed0c68f760b3a33220b1c4bcc60ee8ed6b224d5ec28a04 |
| https://securemedy.ng/special-events-security-planning-guide/ | 6918 | 2026-10-19T15:19:24.420Z | e73566ecd782968bfd43335d091e5edc9f2feb8cf139fa30afefceb9bfe0cd9d |
| https://securemedy.ng/security-guard-services-healthcare-facilities-maryland/ | 7764 | 2026-10-19T15:19:25.241Z | 9bbe759f0ceb53d41eebc1505696bb2699d73bdc4a36ac29bb9bef2dd84b34af |
| https://securemedy.ng/security-guard-careers-maryland-virginia-dc/ | 8134 | 2026-10-19T15:19:25.986Z | bab893ad726b401366b119b2d70690b0a22114b740010d7be578a13c632038d1 |
| https://securemedy.ng/ceo-address/ | 1636 | 2026-10-19T15:19:28.026Z | 445ca5ca8df8b2493161d427204ca521ab3fa980318cd01ca7f09c0595b77fc5 |
| https://securemedy.ng/sms-consent-form/ | 3434 | 2026-10-19T15:19:29.201Z | d27c6266db36d859040ebadce8b60760e7fa5cfe33d07942623cab7760310861 |
| https://securemedy.ng/announcement/ | 3468 | 2026-10-19T15:19:30.258Z | 7c111ed72741791854d7b35d30f955fa072361ca33acb04c1f51424bcd38b482 |
| https://securemedy.ng/careers/jobs/armed-security-officer-cleared/ | 1776 | 2026-10-19T15:19:31.053Z | 533c7fc34fdae28bf7dacbbb935877a082b7f626347a2482228b733ccb96fd8b |
| https://securemedy.ng/careers/jobs/uniformed-protection-officer-critical-infrastructure/ | 1271 | 2026-10-19T15:19:32.286Z | 604aa574e299dbc47495bd41d86308b765d19673a2553a3a4aaac0adcde8bc76 |
| https://securemedy.ng/careers/jobs/risk-assessment-specialist/ | 1470 | 2026-10-19T15:19:33.261Z | 604fae95a1949a91a4183cd2078758d85b3f920c3a6feea1887bbcc49d3f9b22 |
| https://securemedy.ng/careers/jobs/emergency-management-coordinator/ | 1286 | 2026-10-19T15:19:34.340Z | c4a078d62eacf76aa5db5266290168ba5d85182d3a122dc0201c1597f0f3a35c |
| https://securemedy.ng/careers/jobs/executive-protection-agent/ | 1385 | 2026-10-19T15:19:34.806Z | a69e710ba56a9420c4a2e06f9ff2977a478af52271ff373d31008af37fdb2c4d |
| https://securemedy.ng/careers/jobs/security-operations-center-soc-analyst/ | 1475 | 2026-10-19T15:19:36.099Z | db2e1d1d43659acb10902606967a48d02d0393ea2f3c69dba4d0859bdf14c714 |
| https://securemedy.ng/careers/jobs/personnel-security-specialist-adjudications-support/ | 1503 | 2026-10-19T15:19:37.103Z | 108cad8514b6c0b3d8d1de7c690d51e580de7ef1edbc40017b6be7967cc308c5 |
| https://securemedy.ng/service/special-events-security/ | 1313 | 2026-10-19T15:19:38.102Z | a9e301fa98f247a6273d0e01af999b10d56279a11485efc1e35f595dc931cf50 |
| https://securemedy.ng/division/personnel-security/ | 1760 | 2026-10-19T15:19:39.133Z | fd32e93fd17d4dc5047d41981004830ec1e4a6c473fe1da33211de68194a1362 |
| https://securemedy.ng/division/executive-protection/ | 1675 | 2026-10-19T15:19:40.127Z | c17ceebd2d487af66b53dae42fe5eb5762006829a2d11a12674d54b90a131b02 |
| https://securemedy.ng/division/emergency-management/ | 1633 | 2026-10-19T15:19:41.150Z | cb2c2191168de07626548b352d1abd67f609b2e567dbf236e3274efe6798c1a3 |
