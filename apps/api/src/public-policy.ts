import { AssistantResponseSchema, type AssistantResponse } from "@medy/shared";
import {
  PUBLIC_LINKS,
  openPublicConflicts,
  getPublicKnowledge,
} from "./public-knowledge.js";
const contactPattern =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?1[- .]?)?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}|\b\d{10,15}\b|\+\d[\d ()-]{6,18}\d/gi;
export function redactContactDetails(text: string) {
  return text.replace(
    contactPattern,
    "[contact detail removed; use the consent form]",
  );
}

export function publicBoundary(message: string): AssistantResponse | undefined {
  const q = message.toLowerCase();
  if (
    /\b(active shooter|immediate danger|life threatening|severe bleeding|not breathing|someone is shooting|building is on fire|911)\b/.test(
      q,
    )
  )
    return AssistantResponseSchema.parse({
      message:
        "If anyone is in immediate danger, call 911 or the appropriate local emergency number now. Medy cannot dispatch, monitor or arrange emergency assistance.",
      intent: "emergency",
      confidence: 1,
    });
  if (
    /\b(password|verification code|one time code|access code|camera blind spots?|patrol routes?|confidential facility plans?|private employee records|social security|ssn|bank account)\b/.test(
      q,
    )
  )
    return AssistantResponseSchema.parse({
      message:
        "I can't collect or disclose credentials, private employee records or sensitive security procedures. Please use an authorized SecureMedy channel.",
      intent: "sensitive_information",
      confidence: 1,
    });
  if (redactContactDetails(message) !== message)
    return AssistantResponseSchema.parse({
      message:
        "Please use the optional request form to consent before sharing contact details. I have not submitted a lead or notified anyone.",
      intent: "contact_consent",
      confidence: 1,
      actions: [
        {
          id: "request-security-services",
          type: "start_form",
          label: "Request Security Services",
          requiresConfirmation: false,
        },
      ],
    });
}
export function conflictBoundary(
  question: string,
): AssistantResponse | undefined {
  const rules: [string, RegExp, string, string][] = [
    [
      "founder",
      /founder|who founded/,
      "founder_unknown",
      "Founder, Chairman and current owner are different roles. Current ownership is unverified, and I don't have approved founder attribution; please consult the About Us page.",
    ],
    [
      "owner",
      /\bowner\b|ownership|who owns/,
      "ownership_review",
      "I don't have verified ownership information. A Chairman or founder title does not establish current ownership.",
    ],
    [
      "founder",
      /chairman|olabanji|folayan/,
      "leadership_review",
      "Chairman, founder and current owner are different roles. The leadership attribution is awaiting owner review; please consult the About Us page.",
    ],
    [
      "founding-year",
      /when.*(?:start|found|establish)|what year|how long|\b(?:founded|established) in\b/,
      "company_founded",
      "Public sources conflict about the founding year. I can't confirm it until the owner reviews the evidence.",
    ],
    [
      "address",
      /\baddress\b|headquarters|where.*(?:office|located|location)|main office|your office|20744|20745/,
      "contact_information",
      "Public sources contain conflicting address details. Please confirm the current address with SecureMedy using the Contact page or verified phone number.",
    ],
    [
      "state-coverage",
      /licens|what states|state coverage|coverage area|service area|(?:operate|serve|cover|available).*\b(?:virginia|maryland|va|md|state)\b/,
      "licensing",
      "I can't confirm current state coverage or licensing from the approved information. SecureMedy must confirm availability for your location.",
    ],
    [
      "licenses",
      /license number|license status/,
      "licensing",
      "A dated license listing does not confirm current status. Please ask SecureMedy to confirm with the relevant regulator.",
    ],
    [
      "certifications",
      /certif|endors/,
      "credentials_review",
      "I don't have approved current certification or endorsement details.",
    ],
    [
      "case-studies",
      /named client|client names|who are your clients|case stud|government contract/,
      "references_review",
      "I don't have approved client or contract references to share.",
    ],
    [
      "testimonials",
      /testimonial/,
      "references_review",
      "Testimonials require publication review; I don't have approved endorsements to share.",
    ],
    [
      "entity",
      /nigeria|nigerian|legal entity|contracting entity/,
      "entity_review",
      "The website entity and branding metadata is under review. Please confirm the contracting entity directly with SecureMedy; page metadata alone does not establish it.",
    ],
  ];
  const open = new Set(openPublicConflicts().map((c) => c.factKey));
  for (const [key, pattern, intent, text] of rules)
    if (
      !(
        key === "founder" &&
        getPublicKnowledge().some(
          (entry) =>
            entry.id === "leadership" &&
            entry.approvalBasis === "official_website",
        )
      ) &&
      open.has(key) &&
      pattern.test(question.toLowerCase())
    )
      return AssistantResponseSchema.parse({
        message: text,
        intent,
        confidence: 1,
        actions: [
          ...(["founder", "owner", "founding-year", "entity"].includes(key)
            ? [
                {
                  id: "about-page",
                  type: "open_external" as const,
                  label: "About SecureMedy",
                  target: PUBLIC_LINKS.about,
                  requiresConfirmation: false,
                },
              ]
            : []),
          {
            id: "contact-page",
            type: "open_external",
            label: "Contact SecureMedy",
            target: PUBLIC_LINKS.contact,
            requiresConfirmation: false,
          },
        ],
      });
}
