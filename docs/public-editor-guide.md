> Historical report/workflow: the owner-authorized official-website refresh policy and current inventory are documented in [Public v1 final update](public-v1-final.md). Its first-party approval policy supersedes earlier manual-approval requirements; production activation remains restricted.

# Local knowledge editor procedure

This is a filesystem-authorized workflow for the repository owner/editor. There is **no HTTP knowledge admin service**. Protect repository/snapshot write access with OS permissions and use human review before any commit/deployment. Actor names are an audit trail, not an authentication system. Never put private employee, applicant or client records into this store.

## Inspect and refresh research

~~~powershell
npm run knowledge -w @medy/api -- inventory
npm run knowledge -w @medy/api -- crawl
~~~

The crawl reads knowledge/editorial/crawl-seeds.txt, discovers allowed sitemap/internal pages and writes research sources only. It never changes approved answer text or approves candidates. Review crawl-report.json for limits/failures, then source-manifest.md and store.json for evidence. A failed/blocked robots check defers the host rather than bypassing it. LinkedIn/regulator links in the seed are citations only; do not add them to the crawler allowlist.

Run manual refreshes weekly or before publication. Navigation verification expires after 30 days; curated fact expiry is independent and enforced on every retrieval. Suggested editorial refresh: stable services/company FAQs 90 days, contact details 30 days, live vacancies/licenses only with dated primary verification and a short explicit expiry. No active vacancy or state-license claim is currently approved.

Source text is untrusted. Write a concise factual summary; do not copy page instructions, scripts, boilerplate, external copyrighted material, testimonials, applicant details, access procedures or internal policies. A source being reachable is not factual approval.

## Create a candidate FAQ

Prepare a local JSON file with these fields, substituting real source/evidence and dates. This example is a template, **not an approval**:

~~~json
{
  "id": "faq-example",
  "topic": "public-resources",
  "answer": "Medy can explain approved public information and point visitors to the relevant SecureMedy page.",
  "sourceUrl": "https://securemedy.ng/services/",
  "sourceTitle": "SecureMedy Services",
  "verifiedAt": "2026-10-19",
  "lastVerifiedAt": null,
  "reviewStatus": "dynamic",
  "examples": ["How can Medy help?"],
  "aliases": ["assistant capabilities"],
  "factKeys": [],
  "refreshDays": 30,
  "expiresAt": "2026-11-18T00:00:00Z"
}
~~~

~~~powershell
npm run knowledge -w @medy/api -- add C:/path/to/faq-candidate.json
~~~

New entries are forced to public/needs-review. Their hash and first version are recorded. verifiedAt on an imported draft is the document date, not proof of verification: lastVerifiedAt remains null until actual approval. Candidate entries cannot be retrieved by either public provider.

## Correct, approve, reject or withdraw

Use a review JSON file:

~~~json
{
  "id": "faq-example",
  "state": "approved",
  "actor": "ACTUAL_AUTHORIZED_REVIEWER",
  "reason": "Actual source evidence and verification notes",
  "patch": {
    "verifiedAt": "2026-10-19",
    "expiresAt": "2026-11-18T00:00:00Z",
    "refreshDays": 30
  }
}
~~~

~~~powershell
npm run knowledge -w @medy/api -- review C:/path/to/review.json
~~~

Replace the date with the current UTC verification date. Approval requires a real reviewer/reason, today's verification date, future expiry within the declared refresh interval, and no open conflict for the edited fact. Dates are stored in UTC. A patch may change answer, source, examples, action, expiry and fact keys; every revision retains the previous text in the editorial journal. Common instruction-injection patterns are rejected, but human editorial judgment is still required.

Use state=rejected to reject a candidate. Use state=withdrawn to remove a published answer immediately. Use state=needs-review when a correction needs fresh approval. To remove a disputed detail while preserving a safe remainder, explicitly edit the answer and factKeys; automatically inferred high-risk keys still require review. No code edit or rebuild is needed for the running local store.

Do not approve a founding year, address, entity, founder, owner, active vacancy, license, certification, client reference or testimonial by inference. Inspect all evidence in the relevant queue. Founder, Chairman and owner are different roles.

## Resolve a flagged conflict explicitly

Prepare a separate resolution file with id, actor and reason, including the dated primary evidence and the decision:

~~~json
{
  "id": "seed-address",
  "actor": "ACTUAL_AUTHORIZED_REVIEWER",
  "reason": "Actual dated evidence establishing the address and identifying the conflicting page that must be corrected"
}
~~~

~~~powershell
npm run knowledge -w @medy/api -- resolve C:/path/to/resolution.json
~~~

Resolution does not approve any entry. Previously approved entries tagged with that conflict are returned to needs-review; issue a separate review command with verified wording/expiry afterward. New or changed high-risk crawl content can reopen a review queue. Never delete contradictory evidence just to make approval pass.

## Runtime export and safe rollback

~~~powershell
npm run knowledge -w @medy/api -- export ../../data/medy-candidate-public-knowledge.json
~~~

This generates a **local** runtime snapshot with only approved/unexpired/unblocked entries, their latest safe versions, navigation checks and conflict-state metadata. It omits raw sources, research candidates and older disputed wording. It does not deploy, send data, commit, or enable OpenAI. The data/*.json ignore rule keeps the generated snapshot out of Git by default. Validate the output and copy only that selected snapshot if a future release is approved; never upload the data directory, which may contain consented leads.

For a future approved release, point MEDY_PUBLIC_KNOWLEDGE_FILE at the absolute read-only snapshot path. Preserve the full editorial store/journal separately for audit and review. Knowledge updates are single-writer, lock-protected atomic replacements; back up the store before editing. If a stale .lock remains after a crash, confirm no editor/crawler process is running before manually removing that one lock. Do not run parallel editors/crawlers or hand-edit the live JSON.

Rollback with a protected previous reviewed snapshot, or withdraw the affected entries. Do not copy old lead files over current records. The store has an 8 MB read bound; archive old research versions offline under owner control before reaching it, keeping provenance and the approved runtime snapshot intact.

## Owner acceptance

Use knowledge/editorial/conversation-evaluation.json as the human conversation script. Automated mocks validate context transport/retrieval/safety, not the real model's factuality or tone. Any paid live evaluation requires separate explicit approval. Also verify the employee portal manually without indexing it, confirm the consent/privacy copy, check WordPress CSP on the actual host, and approve retention/backup operations. No source draft is approved by this implementation.
