# Production integration handoff

## Current boundary status

- The runtime is entirely deterministic and local; no external language model is integrated.
- Employee endpoints require a fictional demo session, which is not production authentication.
- Administrative routes require `DEMO_MODE=true`; this is a safety gate, not authorization.
- Knowledge status and output contracts are validated with Zod.
- Public and employee knowledge are isolated before matching.
- Leads, unanswered questions, actions, and employee records are fictional local demo data.

## External access gates

Production work requires SecureMedy authorization and authoritative source material for M3dyHub identity and APIs, employee records, approved policies, escalation contacts, CRM/case management, deployment infrastructure, retention, privacy, monitoring, and security controls.

## Implementation map

| Production concern | Replacement boundary |
|---|---|
| Approved knowledge | `apps/api/src/knowledge.ts` |
| Intent and conversation rules | `apps/api/src/conversation.ts` |
| M3dyHub identity and roles | `MockAuthAdapter` in `apps/api/src/providers.ts` |
| Employee data | `employeeData` in `apps/api/src/providers.ts` |
| Public CRM leads | `LocalLeadProvider` |
| Portal navigation | `PortalRoutes` in `packages/shared-types/src/index.ts` |
| React portal integration | `packages/assistant-react` |
| Public website embed | `packages/assistant-widget` |

## Recommended production platform

Use SecureMedy's approved frontend asset hosting, API compute, identity provider, encrypted database, secrets management, WAF, centralized logs and alarms, audit trail, backup, and disaster-recovery standards. The deterministic engine can remain in place unless SecureMedy separately authorizes a different architecture.

## Release gates

1. Security, privacy, and data-classification review
2. Knowledge-owner sign-off and review/expiration metadata
3. Authentication and authorization integration testing
4. Accessibility audit
5. Dependency, container, and penetration testing
6. Human escalation and incident runbooks
7. Limited pilot with measurable rollback criteria
