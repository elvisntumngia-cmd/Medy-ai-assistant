import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ConversationEngine,
  DeterministicIntentMatcher,
} from "./conversation.js";
import { KnowledgeEntrySchema, knowledgeEntries } from "./knowledge.js";

describe("structured deterministic knowledge", () => {
  const matcher = new DeterministicIntentMatcher();
  const testLog = path.join(tmpdir(), "medy-conversation-test-unanswered.json");
  it("validates every entry with the structured Zod schema", () => {
    expect(knowledgeEntries.length).toBeGreaterThanOrEqual(35);
    for (const item of knowledgeEntries)
      expect(KnowledgeEntrySchema.parse(item)).toEqual(item);
  });
  it.each([
    [
      "public",
      "Can I get an estimate for guards at a concert?",
      "event_security_quote",
    ],
    ["employee", "My OT is not on my check", "payroll_issue"],
    ["employee", "I am locked out of the portal", "m3dyhub_access"],
    ["employee", "My gas card does not work", "fleet_issue"],
    ["public", "What regions do you operate in?", "service_areas"],
  ] as const)(
    "matches synonyms and paraphrases: %s",
    (mode, question, intent) => {
      expect(matcher.match(mode, question).selectedIntent).toBe(intent);
    },
  );
  it("never selects employee knowledge in public mode", () => {
    const result = matcher.match(
      "public",
      "missing overtime and uniform pants",
    );
    expect(
      result.matchingKnowledgeEntryIds.every((id) => id.startsWith("pub-")),
    ).toBe(true);
  });
  it.each([
    ["What security services do you offer?", "services"],
    ["I need a quote for event security", "event_security_quote"],
    ["Do you provide healthcare security?", "services"],
    ["How do I apply for a job?", "careers"],
    ["What is my application status?", "application_process"],
    ["Which states do you serve?", "service_areas"],
    ["There is an active threat", "emergency"],
    ["I want to make a complaint", "complaint"],
    ["Contact Sales", "contact_sales"],
    ["Contact Human Resources", "contact_hr"],
  ])("covers public demo scenario: %s", (question, intent) => {
    const engine = new ConversationEngine(testLog);
    expect(engine.respond("public", `public-${intent}`, question).intent).toBe(
      intent,
    );
  });
  it.each([
    ["My payroll has missing hours", "payroll_issue"],
    ["Where can I access my paystub?", "payroll_issue"],
    ["I need to call out for my shift", "shift_callout"],
    ["I will be late for my shift", "attendance"],
    ["I need to request sick leave", "leave_request"],
    ["My schedule is missing", "schedule_help"],
    ["My uniform shirt is damaged", "uniform_request"],
    ["My uniform pants are the wrong size", "uniform_request"],
    ["I lost my access badge", "equipment_issue"],
    ["My security licence expired", "license_status"],
    ["When is my training deadline?", "training"],
    ["I had a non-emergency workplace injury", "workplace_injury"],
    ["My patrol vehicle broke down", "fleet_issue"],
    ["My fuel card is not working", "fleet_issue"],
    ["I cannot log into M3dyHub", "m3dyhub_access"],
    ["Outlook or Teams access is broken", "teams_outlook"],
    ["I need employment verification", "employment_verification"],
    ["Show me the policy handbook", "policy_question"],
    ["I need my supervisor to escalate this", "supervisor_escalation"],
  ])("covers employee demo scenario: %s", (question, intent) => {
    const engine = new ConversationEngine(testLog);
    expect(
      engine.respond("employee", `employee-${intent}-${question}`, question)
        .intent,
    ).toBe(intent);
  });
  it("uses contextual short replies in a multi-turn workflow", () => {
    const engine = new ConversationEngine(testLog);
    const first = engine.respond(
      "employee",
      "short-reply",
      "My uniform is the wrong size",
    );
    expect(first.intent).toBe("uniform_request");
    expect(first.missingRequiredFields).toEqual(["item"]);
    const second = engine.respond("employee", "short-reply", "the pants");
    expect(second.missingRequiredFields).toEqual([]);
    expect(second.message).toContain("details needed");
  });
  it("does not invent exact policy facts", () => {
    const engine = new ConversationEngine(testLog);
    for (const question of [
      "How many PTO days do I get?",
      "What is payday?",
      "Will I be disciplined?",
      "What is my wage rate?",
    ]) {
      const answer = engine.respond("employee", `facts-${question}`, question);
      expect(answer.message).not.toMatch(
        /\b(10 days|15 days|every friday|terminated|\$\d+)\b/i,
      );
    }
  });
});
