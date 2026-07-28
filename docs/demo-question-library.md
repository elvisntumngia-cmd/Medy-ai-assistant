# Medy Assistant demo question library

Medy is a deterministic, rule-based and retrieval-based stakeholder-demo assistant. It is not AI-trained and does not use an external language model. All employee identities and records are fictional.

## Recommended public stakeholder questions

- What security services does SecureMedy offer?
- Can you provide security for a healthcare facility?
- I need an estimate for guards at a concert.
- Do you serve organizations in Virginia?
- How do I apply for a job?
- What qualifications do security officers need?
- Can I check my application status?
- I want to contact Sales.
- How do I contact Human Resources?
- I want to make a complaint about service.
- How can my company become a vendor?

## Recommended employee stakeholder questions

- My payroll has missing hours.
- Where can I access my paystub?
- I need to call out for tonight's shift.
- I will be late tomorrow.
- I need to request sick leave.
- My schedule is missing.
- My uniform shirt is damaged.
- My pants are the wrong size.
- I lost my access badge.
- My security licence expired.
- When is my training due?
- I was injured at work.
- My patrol vehicle broke down.
- My fuel card is not working.
- I cannot log into M3dyHub.
- Outlook is not working.
- I need employment verification.
- Show me the attendance policy.
- I need to escalate this to my supervisor.
- Reset conversation.

## Multi-turn demo scripts

### Missing payroll hours

1. Employee: “My payroll has missing hours.”
2. Medy asks for the affected pay period or work date.
3. Employee: “Yesterday.”
4. Medy confirms that the demonstration workflow has the required details and offers Payroll actions.

### Wrong uniform size

1. Employee: “My uniform is the wrong size.”
2. Medy asks which item is affected.
3. Employee: “The pants.”
4. Medy offers the Uniform Request workflow and states that Logistics must confirm inventory.

### Event-security quote

1. Public visitor: “I need security for an event.”
2. Answer each focused prompt: location, date, estimated attendance, and requested coverage.
3. Medy confirms that enough demonstration details were collected and offers the quote-request action.

### Workplace incident

1. Employee: “I need to report a client-site incident.”
2. Medy asks whether everyone is currently safe.
3. Employee: “Yes.”
4. Medy continues the non-emergency demonstration workflow.

## Difficult questions

- Exactly how many PTO days do I receive?
- What day will Payroll correct my check?
- Will I be disciplined for arriving late?
- Am I legally entitled to overtime?
- Can you guarantee security coverage tomorrow?
- Why was my job application rejected?

Expected behavior: Medy must avoid inventing policy, payroll, disciplinary, legal, availability, or hiring facts and route the user to the authorized department.

## Expected safe fallback questions

- Can you diagnose my refrigerator?
- What stock should I buy?
- Write my legal complaint.
- Tell me another employee's salary.
- Give me a coworker's home address.

Expected behavior: Medy states that confidence is low, offers up to three likely supported topics when available, offers department routing, and writes only a local demo-only unanswered-question record.

## Known unsupported areas

- Legal, medical, tax, or financial advice
- Real-time dispatch or emergency response
- Official policy interpretation without an approved source
- Real employee, applicant, payroll, benefits, or disciplinary records
- Exact wage rates, PTO allowances, paydays, or benefits eligibility
- Decisions about hiring, discipline, liability, or licensing
- Real messages to supervisors or departments

## Emergency examples

- There is an active threat.
- Someone has a weapon.
- A coworker is not breathing.
- There is a fire at the site.
- Someone has a life-threatening injury.

Expected behavior: Medy immediately directs the user to call 911 or local emergency services, move to safety if possible, and notify the appropriate SecureMedy supervisor. It must not delay that guidance with follow-up questions.

## Role-specific examples

### Security officer

- My shift is missing.
- I lost my badge.
- My patrol vehicle broke down.
- My overtime is missing.

### Operations manager

- Open my approvals.
- I need to escalate a site incident.
- A team member reported damaged equipment.
- Where is the operations guidance?

### HR administrator

- Route an employment-verification question.
- Show the demonstration compliance resources.
- Help with a leave-status question.
- How should an employee contact HR?

