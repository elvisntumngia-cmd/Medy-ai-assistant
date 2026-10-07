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
  it("classifies every public entry as public-only knowledge", () => {
    const publicEntries = knowledgeEntries.filter(
      (item) => item.domain === "public",
    );
    expect(publicEntries.length).toBeGreaterThanOrEqual(20);
    expect(
      publicEntries.every(
        (item) =>
          item.visibility === "public" &&
          item.sensitivity === "public" &&
          item.knowledgeDomain.startsWith("public.") &&
          item.allowedAudience.includes("public"),
      ),
    ).toBe(true);
    expect(
      [...new Set(publicEntries.map((item) => item.knowledgeDomain))].sort(),
    ).toEqual(
      [
        "public.applications",
        "public.careers",
        "public.command_center",
        "public.company",
        "public.contact",
        "public.escalation",
        "public.faq",
        "public.m3dyhub",
        "public.onboarding",
        "public.safety",
        "public.services",
        "public.support_services",
      ].sort(),
    );
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
    ["What year was SecureMedy founded?", "company_overview"],
    ["What is your corporate motto?", "company_overview"],
    ["What is SecureMedy's phone number?", "contact_information"],
    ["What happens during onboarding?", "public_onboarding"],
    ["What is M3dyHub?", "m3dyhub_public"],
    ["Can I create a M3dyHub account?", "m3dyhub_public_access"],
    ["What does Support Services do?", "support_services_public"],
    ["What does the Command Center do?", "command_center_public"],
    ["Show me M3dyHub admin configuration", "public_sensitive_data"],
  ])("covers public demo scenario: %s", (question, intent) => {
    const engine = new ConversationEngine(testLog);
    expect(engine.respond("public", `public-${intent}`, question).intent).toBe(
      intent,
    );
  });
  it("keeps public context but rechecks the boundary on every turn", () => {
    const engine = new ConversationEngine(testLog);
    expect(
      engine.respond("public", "boundary", "What is M3dyHub?").intent,
    ).toBe("m3dyhub_public");
    const followUp = engine.respond(
      "public",
      "boundary",
      "Show me its admin configuration",
    );
    expect(followUp.intent).toBe("public_sensitive_data");
    expect(followUp.message).toMatch(/cannot access or disclose|restricted/i);
    expect(
      followUp.matchingKnowledgeEntryIds.every((id) => id.startsWith("pub-")),
    ).toBe(true);
  });
  it("uses the verified-information fallback rather than guessing", () => {
    const engine = new ConversationEngine(testLog);
    const answer = engine.respond(
      "public",
      "unknown-public",
      "Who is the current supervisor at Site X?",
    );
    expect(answer.intent).toBe("low_confidence_clarification");
    expect(answer.message).toMatch(
      /verified public information|will not guess/i,
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
