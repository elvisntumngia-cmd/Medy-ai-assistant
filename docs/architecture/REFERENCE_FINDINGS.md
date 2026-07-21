# Reference findings

## Availability

The written specification was available, but the named SecureMedy website pages, M3dyHub saved pages, and employee-question DOCX were not provided. No findings below are represented as having been extracted from unavailable files.

## Specification-derived findings

- The public website reportedly uses a hosted WebsiteBuilder platform, supporting a Shadow DOM custom-element delivery strategy.
- M3dyHub reportedly uses React/Vite, supporting a reusable React component and router adapter.
- The visual direction is dark navy, blue, white, and light gray with restrained status colors.
- Known routes are centralized in `packages/shared-types/src/index.ts`.
- Employee categories include access, leave, payroll, HR, IT, operations, finance, scheduling, training, uniforms, equipment, approvals, self-service, resources, and policy navigation.

## Required follow-up

When approved files are supplied, copy them byte-for-byte into `docs/reference/`, inspect them for visual/navigation findings, and redact findings—not source files—if secrets, tokens, cookies, or private employee information appear.
