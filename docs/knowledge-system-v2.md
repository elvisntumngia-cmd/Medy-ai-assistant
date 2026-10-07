# Medy Knowledge System V2

## Current deployment boundary

The public WordPress assistant searches only entries whose runtime domain is `public`, visibility is `public`, and structured domain begins with `public.`. This filtering occurs before intent matching. Public conversation state therefore cannot select an employee or future internal entry.

The current repository is public. It contains the approved public SecureMedy knowledge extracted from the Public AI Chatbot Knowledge Base, but it intentionally does not contain the six confidential internal source documents or their detailed content.

## Public domains

- `public.company`
- `public.services`
- `public.contact`
- `public.careers`
- `public.applications`
- `public.onboarding`
- `public.m3dyhub`
- `public.support_services`
- `public.command_center`
- `public.faq`
- `public.safety`
- `public.escalation`

Public answers use approved source material, avoid unsupported commitments, and defer dynamic values—such as live jobs, service availability, account status, timing, and current URLs—to the authoritative live source.

## Entry metadata

Every entry records a runtime mode, structured knowledge domain, visibility, sensitivity, source document, source authority, status, allowed audience, and whether live verification is required. Status and visibility are independent: approved information may still be internal or restricted.

Supported statuses are:

- `approved`
- `provisional`
- `draft`
- `requires_confirmation`
- `restricted`
- `demo_only`

Supported visibility levels are:

- `public`
- `internal_general`
- `internal_role_restricted`
- `sensitive`

## Source authority

Public precedence is:

1. Current approved public webpage or portal for dynamic public facts.
2. Approved public knowledge-base content.
3. Official user communication only for routing back to its authorized process.
4. Clearly labeled general best practice.

Conflicting, draft, superseded, unapproved, or stale material is not silently merged. The public source refers to `securemedy.com`, while the current WordPress integration uses `securemedy.ng`; URLs therefore remain subject to live verification.

## Internal architecture

The future private adapter recognizes these scopes:

- `internal.m3dyhub`
- `internal.support_services`
- `internal.operations`
- `internal.finance`
- `internal.client_relations`
- `internal.programs_management`

Internal retrieval requires both verified authentication and an explicit matching `knowledgeScopes` grant before retrieval. Client-supplied role, department, employee ID, permissions, scopes, or admin flags are not authorization.

The confidential corpus must be stored in a private repository, database, or object store with encryption, audit logging, retention controls, and server-side access enforcement. It must not be bundled into the public widget, demo frontend, or public Git repository.

## Source-specific internal status

- M3dyHub, Support Services, Finance, and Programs Management contain authoritative process material but include live-system or owner-confirmation requirements.
- Operations is based on a draft source and must not be promoted to controlling policy without Operations approval.
- Client Relations has no standalone approved manual; facts, historical examples, standard practice, and unavailable information must remain distinct.

## Safe updates

1. Confirm the source owner, classification, effective version, and approval status.
2. Classify each fact independently by status, visibility, sensitivity, and live-verification need.
3. Never make internal content public merely because its subject overlaps with a public topic.
4. Add direct, indirect, adversarial, and multi-turn tests.
5. Test the pre-retrieval boundary and API authorization separately.
6. Review unanswered questions and source conflicts without inventing missing policy.

## Testing expectations

Public tests must cover company information, services, contact details, careers, applications, onboarding, M3dyHub, Support Services, Command Center, emergencies, privacy, restricted requests, unknown information, follow-up attacks, API field injection, CORS, widget embedding, and regression behavior.

## Future Bedrock path

The structured metadata is suitable for later ingestion into a private Amazon Bedrock knowledge architecture. Bedrock is not currently enabled. A future implementation must preserve pre-retrieval authorization filters, source metadata, citations, status handling, and deterministic safety policy instead of relying on post-generation redaction.
