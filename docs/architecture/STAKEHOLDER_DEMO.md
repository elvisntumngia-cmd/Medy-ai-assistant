# Medy Assistant stakeholder demonstration

## Accuracy and safety note

Employee access requires an explicitly provisioned fictional demo session. It fails closed when the session is missing or unknown, but it is not production authentication. Demo controls and lead administration require `DEMO_MODE=true`; the root development command enables it for this presentation. Bedrock is an `InvokeModelCommand` SDK scaffold only: no real AWS invocation has been completed, no Guardrail is configured, and no Bedrock Knowledge Base is connected. Playwright runs on isolated ports with temporary lead/action files.

## Five-minute walkthrough

### 1. Position the concept — 30 seconds

“Medy Assistant is a shared AI support platform with two governed experiences: public customer support and authenticated employee support. This demonstration uses only fictional local data. No production request is dispatched and no official policy is represented.”

Open `http://localhost:5180`.

### 2. Public support and lead capture — 90 seconds

1. Open **Ask Medy**.
2. Ask: “What security services are available?”
3. Select **Request Security Services**.
4. Complete the intake with demonstration contact information.
5. Review the structured summary and save it.
6. Point out the demonstration disclaimer and local reference number.
7. Open `/admin/leads` to show the captured record.

Key message: the experience can later connect to an approved CRM without changing the public conversation UI.

### 3. Employee personalization — 60 seconds

Open `/employee/dashboard`. Show the fictional profile for James Carter, recent requests, training, license status, and approval count. Open the dedicated **Medy Assistant** workspace.

Key message: the portal experience uses a separate employee mode, trusted server-side identity boundary, and employee-only knowledge domain.

### 4. Guided employee workflows — 90 seconds

Ask each question:

- “I need a new uniform.” Show the configured Uniform Request route.
- “My overtime is missing.” Show the fictional payroll record and confirmation-gated write action.
- “Find the attendance policy.” Point out the conspicuous demonstration-content disclaimer.
- “My guard card expires soon.” Show the fictional expiration data and HR/Compliance guidance.

Key message: Medy answers, presents structured data, and guides employees into existing workflows rather than silently performing consequential actions.

### 5. Governance and readiness — 30 seconds

Open `/control`. Demonstrate failure handling, simulated delay, provider selection, action audit history, role selection, and centralized route mappings.

Close with: “The prototype runs without AWS credentials. Its provider boundaries are ready for an approved Bedrock model, Bedrock Knowledge Base, M3dyHub APIs, SSO, and CRM integration.”

## Presenter checklist

- Start the application and verify `/api/health` before the meeting.
- Keep the browser at 100% zoom and use a window at least 1280 pixels wide.
- Reset the demo session and remove unwanted test leads.
- Use only fictional `.test` email addresses and demonstration phone numbers.
- Keep a production build or screen recording available as a fallback.
- Never describe demonstration policy text as official SecureMedy guidance.
