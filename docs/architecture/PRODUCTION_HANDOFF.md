# Production integration handoff

## Current boundary status

- The built API starts with `npm run start --workspace apps/api` after `npm run build`.
- Employee endpoints require an explicit fictional demo session; this is not production authentication.
- Administrative demo routes exist only when `DEMO_MODE=true`; this is a safety gate, not authorization.
- Playwright uses dedicated ports and temporary data-file paths with server reuse disabled.
- Bedrock is an `InvokeModelCommand` SDK scaffold. No real AWS invocation has been completed.
- Requested reference HTML, Word, and PDF assets are absent, so exact parity remains unverifiable.

## External access gates

The following cannot be completed locally and require SecureMedy authorization or approved source material:

- AWS account, deployment environment, IAM roles, network boundaries, logging destinations, and encryption keys
- Approved Amazon Bedrock model and Bedrock Knowledge Base configuration
- M3dyHub source repository, API contracts, SSO/session mechanism, roles, and route ownership
- CRM or case-management destination for public leads
- Approved public website content, brand assets, privacy language, employee policies, and department escalation contacts

## Implementation map

| Production concern | Replacement boundary |
|---|---|
| Bedrock inference | `apps/api/src/providers.ts` → `BedrockAIProvider` |
| Bedrock Knowledge Base | `apps/api/src/providers.ts` → `BedrockKnowledgeProvider` |
| M3dyHub identity and roles | `AuthAdapter` in `apps/api/src/providers.ts` |
| Employee APIs | `EmployeeDataProvider` in `apps/api/src/providers.ts` |
| Public CRM leads | `LeadProvider` in `apps/api/src/providers.ts` |
| Portal navigation | `routes` in `packages/shared-types/src/index.ts` |
| React portal integration | `packages/assistant-react` |
| Public website embed | `packages/assistant-widget/dist/medy-assistant.js` |

## Recommended AWS target

- CloudFront/S3 or the approved existing public asset pipeline for the widget bundle
- API Gateway or Application Load Balancer in front of a containerized Node API
- ECS Fargate or the organization’s approved compute platform
- Bedrock Runtime and Bedrock Knowledge Bases through least-privilege workload IAM
- DynamoDB or Aurora for leads, conversations, confirmations, and action audits
- KMS encryption, Secrets Manager, WAF, CloudWatch logs/alarms, CloudTrail, and approved retention controls
- Private connectivity and explicit authorization checks for M3dyHub-facing employee operations

## Release gates

1. Security architecture and privacy review
2. Data classification and retention approval
3. Official knowledge-owner sign-off and expiration metadata
4. Authentication and authorization testing
5. Model evaluation for accuracy, isolation, prompt injection, and unsafe actions
6. Accessibility audit against the organization’s required WCAG target
7. Penetration test and dependency/container scanning
8. Limited pilot with measurable escalation and rollback criteria
9. Operations runbook, incident ownership, dashboards, alerts, and disaster recovery exercise
