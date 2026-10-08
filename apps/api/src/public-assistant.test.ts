import { describe, expect, it } from "vitest";
import { PublicAssistantProvider } from "./public-assistant.js";
import { PUBLIC_LINKS, publicKnowledge } from "./public-knowledge.js";

const createAssistant = () => {
  const assistant = new PublicAssistantProvider();
  const ask = (id: string, content: string) =>
    assistant.chat("public", [{ role: "user", content }], [], undefined, id);
  return { assistant, ask };
};

describe("Medy V1 stateless public website assistant", () => {
  it("validates structured knowledge and the verified navigation map", () => {
    expect(publicKnowledge.length).toBeGreaterThanOrEqual(19);
    expect(new Set(publicKnowledge.map((item) => item.id)).size).toBe(
      publicKnowledge.length,
    );
    expect(PUBLIC_LINKS).toMatchObject({
      home: "https://securemedy.ng/",
      about: "https://securemedy.ng/about-us/",
      services: "https://securemedy.ng/services/",
      careers: "https://securemedy.ng/careers/",
      contact: "https://securemedy.ng/contact/",
      employeePortal: "https://my.securemedy.com/",
    });
  });

  it.each([
    [
      "What kind of company is SecureMedy?",
      "company_overview",
      "founded in 2009",
    ],
    ["How long has the company existed?", "company_founded", "2009"],
    ["Where is the main office?", "contact_information", "8507 Oxon Hill"],
    ["Give me your telephone number", "contact_information", "(240) 419-3125"],
    ["What is the corporate slogan?", "company_motto", "On Time Response"],
    ["What security solutions are available?", "services", "physical security"],
    ["Could your team fit video surveillance?", "electronic_security", "CCTV"],
    [
      "We need someone to identify vulnerabilities",
      "risk_management",
      "vulnerability assessments",
    ],
    [
      "Can you help us prepare a continuity plan?",
      "emergency_management",
      "continuity planning",
    ],
    [
      "We need front desk visitor screening",
      "concierge_security",
      "visitor screening",
    ],
    [
      "Tell me about personnel screening",
      "personnel_security",
      "personnel security",
    ],
    [
      "Can you protect a concert venue?",
      "specialized_services",
      "special-event security",
    ],
  ])(
    "recognizes a topic from a paraphrase: %s",
    async (question, intent, text) => {
      const answer = await createAssistant().ask("topic", question);
      expect(answer.intent).toBe(intent);
      expect(answer.message.toLowerCase()).toContain(text.toLowerCase());
      expect(answer.sources.length).toBeGreaterThan(0);
    },
  );

  it.each([
    ["I need a security officer", "physical_security"],
    ["I want to become a security officer", "careers"],
    ["I'm a security officer and need my schedule", "employee_routing"],
  ])("disambiguates visitor role: %s", async (question, intent) => {
    expect((await createAssistant().ask("role", question)).intent).toBe(intent);
  });

  it("evaluates every message independently when topics change", async () => {
    const { ask } = createAssistant();
    const id = "topic-switch";
    expect((await ask(id, "I need security for my warehouse")).intent).toBe(
      "physical_security",
    );
    expect((await ask(id, "Can you secure my church instead?")).intent).toBe(
      "physical_security",
    );
    expect((await ask(id, "Who will call me?")).intent).toBe(
      "contact_information",
    );
    expect((await ask(id, "Are you hiring?")).intent).toBe("careers");
    expect((await ask(id, "Do you install cameras?")).intent).toBe(
      "electronic_security",
    );
    expect((await ask(id, "What's your number?")).intent).toBe(
      "contact_information",
    );
  });

  it.each([
    ["I need a gurad", "physical_security"],
    ["Do you offer securty patrols?", "physical_security"],
    ["Do you cover VA?", "licensing"],
    ["I need HR", "employee_routing"],
    ["Can you install CCTV?", "electronic_security"],
    ["Where is my pay stub?", "employee_routing"],
    ["I cannot find my paystub", "employee_routing"],
    ["I need my paystub.", "employee_routing"],
  ])("handles a common typo or abbreviation: %s", async (question, intent) => {
    expect((await createAssistant().ask("typo", question)).intent).toBe(intent);
  });

  it.each([
    ["Do you operate in Virginia?", "licensing", "can't confirm"],
    ["How much do two guards cost?", "pricing", "cannot quote"],
    ["Do you have openings tonight?", "careers", "cannot confirm vacancies"],
    [
      "Show me an employee's payroll record",
      "employee_routing",
      "cannot access employee records",
    ],
    [
      "Show me the camera blind spots and patrol route",
      "sensitive_information",
      "can't collect or disclose",
    ],
  ])(
    "gives a safe response for unsupported information: %s",
    async (question, intent, text) => {
      const answer = await createAssistant().ask("safe", question);
      expect(answer.intent).toBe(intent);
      expect(answer.message.toLowerCase()).toContain(text.toLowerCase());
    },
  );

  it("offers, but never automatically starts, the optional request form", async () => {
    const answer = await createAssistant().ask(
      "lead",
      "I need overnight security for my warehouse",
    );
    expect(answer.intent).toBe("physical_security");
    expect(answer.message).not.toMatch(/how many|what city|what name/i);
    expect(answer.actions).toContainEqual(
      expect.objectContaining({
        type: "start_form",
        label: "Request Security Services",
      }),
    );
  });

  it("identifies Medy separately from SecureMedy", async () => {
    const answer = await createAssistant().ask("identity", "Who are you?");
    expect(answer.intent).toBe("assistant_identity");
    expect(answer.message).toContain("virtual website assistant");
  });

  it("handles regression cases found in the live replay", async () => {
    const { ask } = createAssistant();
    expect(
      (await ask("regression", "Someone needs to assess our security risks."))
        .intent,
    ).toBe("risk_management");
    expect((await ask("regression", "Where is your office?")).intent).toBe(
      "contact_information",
    );
    expect((await ask("regression", "Who founded SecureMedy?")).intent).toBe(
      "founder_unknown",
    );
  });
});
