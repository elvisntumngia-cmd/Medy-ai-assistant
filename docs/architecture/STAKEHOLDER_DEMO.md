# Medy Assistant stakeholder demonstration

## Accuracy and safety note

Medy is a deterministic rule-based and retrieval-based demo assistant. It does not use an external language model and is not AI-trained. Employee access uses explicitly provisioned fictional sessions, not production authentication. Public and employee knowledge are strictly separated. Non-approved knowledge is labeled provisional, demo-only, or requiring SecureMedy confirmation.

## Five-minute walkthrough

1. Open `http://localhost:5180`, launch Medy, and ask about security services.
2. Ask for an event-security quote and answer the focused location, date, attendance, and coverage questions.
3. Open `/employee/dashboard`, then `/employee/assistant`.
4. Ask “My payroll has missing hours,” then answer “Yesterday.”
5. Ask “My uniform is the wrong size,” then answer “The pants.”
6. Ask for the policy handbook and point out the provisional-content disclaimer.
7. Ask an unsupported question and show safe clarification rather than an invented answer.
8. Use an emergency example and show that fixed 911 guidance takes precedence.
9. Open `/control` to demonstrate fictional roles, simulated delay/error behavior, action audits, and reset.

## Presenter checklist

- Verify `/api/health` reports `deterministic-local`.
- Use only fictional `.test` contact data.
- Reset local demo data before presenting.
- Never describe demonstration content as official policy.
- Never claim human-level understanding or model training.
- Keep the question library in `docs/demo-question-library.md` available.
