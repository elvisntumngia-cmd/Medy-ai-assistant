# Medy V1 Public Assistant

Verified: 2026-10-07

## Architecture

Medy V1 extends the restored provider architecture. `PublicAssistantProvider` implements the existing `AIProvider` interface; employee mock behavior and the Bedrock scaffold remain separate. Public knowledge is structured and schema-validated in `apps/api/src/public-knowledge.ts`. It contains no internal department material.

The public response pipeline is bounded:

1. Emergency and sensitive-information boundaries.
2. Applicant and employee routing.
3. Topic interpretation from normalized terms, aliases and common typo corrections.
4. Retrieval from schema-validated public knowledge.
5. Confidence-aware response and verified next actions.
6. Safe clarification when evidence is insufficient.

Public chat is deliberately stateless. Every message is interpreted independently, so a visitor can change topics without cancelling or completing a workflow. The optional legacy request form opens only when the visitor explicitly selects **Request Security Services**.

## Website crawl and source report

Public pages reviewed:

- `https://securemedy.ng/`
- `https://securemedy.ng/about-us/`
- `https://securemedy.ng/services/`
- `https://securemedy.ng/service/physical-security/`
- `https://securemedy.ng/service/electronic-security/`
- `https://securemedy.ng/service/risk-management/`
- `https://securemedy.ng/service/personnel-security/`
- `https://securemedy.ng/service/emergency-management/`
- `https://securemedy.ng/service/concierge-services/`
- `https://securemedy.ng/industries-served/`
- `https://securemedy.ng/careers/`
- `https://securemedy.ng/contact/`
- `https://securemedy.ng/privacy-policy/`
- `https://securemedy.ng/terms/`

Owner-approved values override conflicting or dynamic website copy. Notable conflicts:

- The site HTML title says “Securemedy Nigeria Limited”; V1 uses the approved identity “SecureMedy Incorporated.”
- One service page says “over 20 years”; V1 uses the approved founding year 2009.
- Staffing totals, current openings, certification status, state coverage details, pricing, and availability are treated as dynamic.
- Published project and testimonial claims are website material, not independently verified outcomes, and are not currently used for automated answers.

## Verified navigation map

| Purpose              | URL                                                   |
| -------------------- | ----------------------------------------------------- |
| Homepage             | `https://securemedy.ng/`                              |
| About                | `https://securemedy.ng/about-us/`                     |
| Services             | `https://securemedy.ng/services/`                     |
| Physical security    | `https://securemedy.ng/service/physical-security/`    |
| Electronic security  | `https://securemedy.ng/service/electronic-security/`  |
| Risk management      | `https://securemedy.ng/service/risk-management/`      |
| Personnel security   | `https://securemedy.ng/service/personnel-security/`   |
| Emergency management | `https://securemedy.ng/service/emergency-management/` |
| Concierge services   | `https://securemedy.ng/service/concierge-services/`   |
| Industries           | `https://securemedy.ng/industries-served/`            |
| Careers              | `https://securemedy.ng/careers/`                      |
| Contact              | `https://securemedy.ng/contact/`                      |
| Privacy              | `https://securemedy.ng/privacy-policy/`               |
| Terms                | `https://securemedy.ng/terms/`                        |
| Employee portal      | `https://my.securemedy.com/`                          |

## Conversation and optional lead form

The assistant answers public facts and service-discovery questions immediately. Mentioning a security need does not start qualification or collect contact details. The response explains the relevant service and offers verified service/contact links plus an optional request-form action.

The separately opened legacy request form requires:

- Name
- Email or phone
- General service need
- Explicit permission to contact
- Final submission confirmation after review

Medy does not collect access codes, patrol routes, camera blind spots, confidential plans, passwords, MFA codes, banking information, SSNs, or government identification numbers.

## Persistence

`LeadRepository` has three adapters:

- `PostgresLeadRepository`: selected when `DATABASE_URL` is configured.
- `FileLeadRepository`: local demonstration fallback; not durable on Render.
- `MemoryLeadRepository`: automated tests only.

Migration: `apps/api/migrations/001_create_medy_public_leads.sql`.

Run the migration using the organization’s approved PostgreSQL migration process before enabling `DATABASE_URL`. Production must not rely on local JSON storage. PostgreSQL TLS certificate verification defaults to enabled.

Duplicate submissions use matching contact information and service category within 24 hours. The public API has general rate limiting, and the legacy form-write route has an additional 10 submissions per 15 minutes limit.

Retention duration and deletion authorization still require SecureMedy policy approval. No automatic deletion interval is claimed or enabled until that decision is documented.

## Notifications

`LeadNotificationProvider` separates delivery from persistence. The lead is saved before notification is attempted. Notification state and attempts are recorded, and a failure never deletes the lead. V1 includes only `MockLeadNotificationProvider`; it never sends email.

Reserved configuration:

- `CLIENT_RELATIONS_EMAIL`
- `EMAIL_PROVIDER=mock`

A production provider must be approved and added before real email delivery can be claimed. Logs must not include lead contact details.

## Environment

Required for durable production leads:

- `DATABASE_URL`
- `PGSSL=true`
- `PGSSL_REJECT_UNAUTHORIZED=true`

Optional local demonstration storage:

- `MEDY_CONVERSATIONAL_LEADS_FILE`

Email remains mocked. No real credentials are required or used locally.

## Future Bedrock integration

Bedrock should replace only the conversational interpretation/generation layer. Structured public knowledge, authorization boundaries, lead validation, consent, persistence, deduplication, and notification state must remain deterministic server-side controls. Model output must continue to pass the shared response schema.

## Known limitations

- V1 understands a bounded set of public intents and qualification phrases, not unrestricted language.
- Topic matching is deterministic and supports a bounded vocabulary, aliases and common typo corrections; it is not general natural-language understanding.
- Local file persistence is explicitly simulated and unsuitable for production.
- No real Client Relations email is sent.
- Exact callback timing, prices, staffing, openings, certifications, and location coverage are never promised.
