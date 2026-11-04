import { describe, expect, it } from "vitest";
import { welcome } from "../../../packages/shared-types/src/browser.js";
import { PublicAssistantProvider } from "./public-assistant.js";
import { publicBoundary } from "./public-policy.js";

const unprofessionalTone =
  /(?:great question|absolutely|of course|happy to help|\bhey\b|\bamigo\b|what(?:'|’)s up|just checking us out|[😀-🙏🌀-🫿]|!{1,})/iu;

describe("public corporate tone", () => {
  const provider = new PublicAssistantProvider();
  const ask = (content: string) =>
    provider.chat("public", [{ role: "user", content }], []);

  it.each([
    ["Amigo!", "greeting"],
    ["Who are you?", "assistant_identity"],
    ["What is the weather on Mars?", "public_clarification"],
    ["My password is confidential", "sensitive_information"],
  ])("uses a polished response for %s", async (question, intent) => {
    const response = await ask(question);
    expect(response.intent).toBe(intent);
    expect(response.message).not.toMatch(unprofessionalTone);
    expect(response.message).toMatch(/[.?"]$/);
  });

  it("uses a professional first-person company voice for service information", async () => {
    const response = await ask("What security services do you offer?");
    expect(response.message).toMatch(/^(?:We|Securemedy)\b/);
    expect(response.message).not.toMatch(unprofessionalTone);
    expect(response.message).not.toMatch(/\b(?:they|their)\b/i);
  });

  it("keeps the visitor welcome concise and professional", () => {
    expect(welcome).toBe(
      "Welcome to Securemedy. I am Medy, Securemedy's AI assistant. How may I assist you today?",
    );
    expect(welcome).not.toMatch(unprofessionalTone);
  });

  it("keeps privacy safeguards courteous and formal", () => {
    const response = publicBoundary("My password is secret");
    expect(response?.message).toContain("I cannot collect or disclose");
    expect(response?.message).not.toMatch(unprofessionalTone);
  });
});
