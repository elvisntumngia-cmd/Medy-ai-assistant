import {
  AssistantResponseSchema,
  type AssistantAction,
  type AssistantResponse,
  type EmployeeProfile,
  type Mode,
} from "@medy/shared";
import type { AIProvider, KnowledgeMatch } from "./providers.js";
import {
  PUBLIC_LINKS,
  publicKnowledgeById,
  type PublicKnowledgeItem,
} from "./public-knowledge.js";

type TopicMatch = { knowledgeId: string; intent: string; confidence: number };
const corrections: Record<string, string> = {
  gurad: "guard",
  gurads: "guards",
  securty: "security",
  paystub: "pay stub",
  paystubs: "pay stubs",
};
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9@+\-/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => corrections[word] || word)
    .join(" ");
const hasAny = (q: string, terms: string[]) =>
  terms.some((term) => q.includes(term));
const action = (
  id: string,
  label: string,
  target: string,
): AssistantAction => ({
  id,
  type: "open_external",
  label,
  target,
  requiresConfirmation: false,
});
const requestAction = (): AssistantAction => ({
  id: "request-security-services",
  type: "start_form",
  label: "Request Security Services",
  requiresConfirmation: false,
});
const reply = (
  message: string,
  intent: string,
  options: {
    actions?: AssistantAction[];
    suggestions?: string[];
    source?: PublicKnowledgeItem;
    confidence?: number;
  } = {},
) =>
  AssistantResponseSchema.parse({
    message,
    intent,
    confidence: options.confidence ?? 0.96,
    actions: options.actions || [],
    suggestedQuestions: options.suggestions || [],
    escalation: null,
    sources: options.source
      ? [
          {
            id: options.source.id,
            title: options.source.sourceTitle,
            domain: "public",
            snippet: options.source.answer,
          },
        ]
      : [],
  });
const fromKnowledge = (
  id: string,
  intent: string,
  extraActions: AssistantAction[] = [],
  message?: string,
) => {
  const item = publicKnowledgeById.get(id)!;
  return reply(message || item.answer, intent, {
    source: item,
    actions: [
      ...(item.action
        ? [action(`link-${item.id}`, item.action.label, item.action.url)]
        : []),
      ...extraActions,
    ],
  });
};

const employeeTerms = [
  "pay stub",
  "payroll",
  "my schedule",
  "employee schedule",
  "uniform",
  "request leave",
  "time off",
  "employee training",
  "employee account",
  "employee password",
  "employee login",
  " hr ",
  "contact hr",
  "human resources",
];
const careerTerms = [
  "career",
  "job",
  "hiring",
  "hire me",
  "apply",
  "application",
  "vacancy",
  "opening",
  "employment",
  "work for securemedy",
  "become a security",
  "security work",
  "security officer opportunity",
  "armed position",
  "unarmed position",
];

const interpret = (q: string): TopicMatch | null => {
  if (
    hasAny(q, employeeTerms) ||
    (q.includes("im an employee") && hasAny(q, ["help", "portal", "policy"]))
  )
    return {
      knowledgeId: "employee-portal",
      intent: "employee_routing",
      confidence: 0.99,
    };
  if (hasAny(q, careerTerms))
    return { knowledgeId: "careers", intent: "careers", confidence: 0.98 };
  if (
    hasAny(q, [
      "phone",
      "telephone",
      "number",
      "email",
      "headquarters",
      "address",
      "located",
      "location",
      "main office",
      "your office",
      "office location",
      "contact information",
      "contact you",
      "call me",
      "someone call",
      "speak to someone",
    ])
  )
    return {
      knowledgeId: "company-contact",
      intent: "contact_information",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "cctv",
      "camera",
      "video surveillance",
      "access control",
      "intrusion detection",
      "alarm system",
      "electronic security",
    ])
  )
    return {
      knowledgeId: "electronic-security",
      intent: "electronic_security",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "risk assessment",
      "security assessment",
      "security risk",
      "threat assessment",
      "vulnerability",
      "vulnerabilities",
      "risk management",
      "assess our risk",
    ])
  )
    return {
      knowledgeId: "risk-management",
      intent: "risk_management",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "continuity plan",
      "disaster response",
      "emergency planning",
      "emergency management",
      "crisis plan",
      "fema",
      "coop plan",
    ])
  )
    return {
      knowledgeId: "emergency-management",
      intent: "emergency_management",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "concierge",
      "front desk security",
      "lobby security",
      "visitor screening",
      "security ambassador",
    ])
  )
    return {
      knowledgeId: "concierge-security",
      intent: "concierge_security",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "personnel security",
      "personnel screening",
      "background investigation",
      "background check",
      "security clearance",
      "screening personnel",
    ])
  )
    return {
      knowledgeId: "personnel-security",
      intent: "personnel_security",
      confidence: 0.97,
    };
  if (
    hasAny(q, [
      "event security",
      "concert",
      "venue security",
      "executive protection",
      "bodyguard",
      "investigation",
      "security consulting",
    ])
  )
    return {
      knowledgeId: "specialized-services",
      intent: "specialized_services",
      confidence: 0.95,
    };

  const property = hasAny(q, [
    "warehouse",
    "church",
    "place of worship",
    "hospital",
    "healthcare",
    "school",
    "university",
    "retail",
    "shopping center",
    "residential",
    "apartment",
    "construction site",
    "commercial building",
    "office",
    "industrial",
    "government facility",
    "property",
    "building",
    "venue",
  ]);
  const guardNeed = hasAny(q, [
    "need security",
    "want security",
    "looking for security",
    "hire security",
    "need a guard",
    "need guards",
    "need an officer",
    "need officers",
    "secure my",
    "secure our",
    "protect my",
    "protect our",
    "overnight guard",
    "patrol",
    "armed guard",
    "unarmed guard",
    "security officer",
  ]);
  if (guardNeed || (property && hasAny(q, ["security", "protect", "guard"])))
    return {
      knowledgeId: "physical-security",
      intent: "physical_security",
      confidence: 0.94,
    };
  if (
    hasAny(q, [
      "industries",
      "industry",
      "what properties",
      "types of facilities",
      "who do you serve",
    ]) ||
    property
  )
    return { knowledgeId: "industries", intent: "industries", confidence: 0.9 };
  if (
    hasAny(q, [
      "services",
      "what do you offer",
      "what do you provide",
      "capabilities",
      "security solutions",
      "how can you help",
    ])
  )
    return {
      knowledgeId: "services-overview",
      intent: "services",
      confidence: 0.96,
    };
  if (hasAny(q, ["mission", "vision", "values"]))
    return {
      knowledgeId: "mission-vision",
      intent: "mission_vision",
      confidence: 0.96,
    };
  if (
    hasAny(q, [
      "leadership",
      "chairman",
      "chief executive",
      "ceo",
      "management team",
    ])
  )
    return {
      knowledgeId: "leadership",
      intent: "leadership",
      confidence: 0.94,
    };
  if (hasAny(q, ["who founded", "founder"]))
    return {
      knowledgeId: "company-overview",
      intent: "founder_unknown",
      confidence: 0.7,
    };
  if (
    hasAny(q, [
      "founded",
      "established",
      "what year",
      "how long",
      "company history",
    ])
  )
    return {
      knowledgeId: "company-founded",
      intent: "company_founded",
      confidence: 0.98,
    };
  if (hasAny(q, ["motto", "slogan", "tagline"]))
    return {
      knowledgeId: "company-motto",
      intent: "company_motto",
      confidence: 0.98,
    };
  if (
    hasAny(q, [
      "licensed",
      "license",
      "states",
      "service area",
      "coverage area",
      "virginia",
      " va ",
      "maryland",
      "where do you operate",
    ])
  )
    return {
      knowledgeId: "company-licensing",
      intent: "licensing",
      confidence: 0.94,
    };
  if (hasAny(q, ["privacy", "personal information", "data policy"]))
    return { knowledgeId: "privacy", intent: "privacy", confidence: 0.98 };
  if (
    hasAny(q, [
      "who is securemedy",
      "what is securemedy",
      "what kind of company",
      "about securemedy",
      "about the company",
      "company background",
    ])
  )
    return {
      knowledgeId: "company-overview",
      intent: "company_overview",
      confidence: 0.98,
    };
  return null;
};

/** A deterministic, stateless public website guide behind the existing provider contract. */
export class PublicAssistantProvider implements AIProvider {
  constructor(_legacyLeadWorkflow?: unknown) {}
  reset(_id?: string) {}

  async chat(
    mode: Mode,
    messages: { role: string; content: string }[],
    _context: KnowledgeMatch[],
    _user?: EmployeeProfile,
    _conversationId?: string,
  ): Promise<AssistantResponse> {
    if (mode !== "public")
      throw new Error("The public assistant only accepts public conversations");
    const q = ` ${normalize(messages.at(-1)?.content || "")} `;
    if (
      /\b(911|active shooter|immediate danger|life threatening|weapon|fire|severe bleeding|not breathing)\b/.test(
        q,
      )
    )
      return reply(
        "If anyone is in immediate danger, call 911 or the appropriate local emergency number now. Medy cannot dispatch or monitor emergency assistance.",
        "emergency",
      );
    if (
      /\b(password|mfa|verification code|one time code|access code|camera blind spot|patrol route|confidential facility plan|social security|ssn|bank account)\b/.test(
        q,
      )
    )
      return reply(
        "I can't collect or disclose passwords, verification codes, access details, confidential security procedures, banking information or government identification numbers. Please use an authorized SecureMedy channel.",
        "sensitive_information",
      );
    if (
      /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q) &&
      q.trim().split(" ").length <= 3
    )
      return reply(
        "Hi! I'm Medy, SecureMedy's virtual website assistant. I can help with services, public company information, Careers, employee access and contact options.",
        "greeting",
        {
          suggestions: [
            "Explore services",
            "Request security services",
            "Careers",
            "Contact SecureMedy",
          ],
        },
      );
    if (hasAny(q, ["who are you", "what are you", "are you a bot"]))
      return reply(
        "I'm Medy, SecureMedy's virtual website assistant. I provide verified public information and links, but I don't access private records or dispatch services.",
        "assistant_identity",
        { actions: [action("home", "SecureMedy Website", PUBLIC_LINKS.home)] },
      );
    if (/\b(price|pricing|cost|rate|quote|estimate)\b/.test(q))
      return reply(
        "Pricing depends on the service, location, schedule, staffing and risk requirements. Medy cannot quote a price, but SecureMedy's team can discuss your needs.",
        "pricing",
        {
          actions: [
            action("contact-page", "Contact SecureMedy", PUBLIC_LINKS.contact),
            requestAction(),
          ],
        },
      );
    if (
      hasAny(q, [
        "complaint",
        "billing",
        "contract",
        "service change",
        "vendor",
        "partnership",
        "proposal",
        "contact management",
      ])
    )
      return reply(
        "Please use SecureMedy's general Contact page or call (240) 419-3125 for client, billing, contract, vendor, partnership or management inquiries. Medy does not have a verified department-specific public address for this request.",
        "business_inquiry",
        {
          actions: [
            action("contact-page", "Contact SecureMedy", PUBLIC_LINKS.contact),
          ],
        },
      );

    const match = interpret(q);
    if (match?.intent === "founder_unknown")
      return reply(
        "I don't have a verified public fact identifying SecureMedy's founder. The About Us page provides the approved company background, and the team can answer further questions.",
        match.intent,
        {
          confidence: match.confidence,
          source: publicKnowledgeById.get(match.knowledgeId),
          actions: [
            action("about", "About SecureMedy", PUBLIC_LINKS.about),
            action("contact", "Contact SecureMedy", PUBLIC_LINKS.contact),
          ],
        },
      );
    if (
      match?.intent === "licensing" &&
      hasAny(q, ["virginia", " va ", "specific state", "my state"])
    )
      return fromKnowledge(
        match.knowledgeId,
        match.intent,
        [],
        "SecureMedy is licensed in 16 states and counting, but I can't confirm current coverage in that specific state from the approved public information. Please contact the team to confirm availability.",
      );
    if (match?.intent === "physical_security") {
      const needsConfirmation = hasAny(q, [
        "church",
        "place of worship",
        "residential",
        "apartment",
        "construction site",
      ]);
      const message = needsConfirmation
        ? "SecureMedy provides physical security services, including armed and unarmed officers, access control and patrol solutions. This may fit the property or facility you described, but the team must confirm suitability, licensing and availability for the specific location."
        : "SecureMedy provides physical security services, including armed and unarmed officers, access control and specialized patrol solutions. The team can discuss coverage requirements and confirm staffing, licensing and availability for your location.";
      return fromKnowledge(
        match.knowledgeId,
        match.intent,
        [
          action("contact", "Contact SecureMedy", PUBLIC_LINKS.contact),
          requestAction(),
        ],
        message,
      );
    }
    if (match?.intent === "services")
      return fromKnowledge(match.knowledgeId, match.intent, [requestAction()]);
    if (match) return fromKnowledge(match.knowledgeId, match.intent);
    if (/^( reset| start over| cancel| never mind| nevermind )$/.test(q))
      return reply(
        "There is no active chat workflow to cancel. You can ask a new question at any time.",
        "conversation_reset",
        { suggestions: ["Explore services", "Contact SecureMedy", "Careers"] },
      );
    return reply(
      "I don't have enough verified public information to answer that confidently. I can help with SecureMedy's services, company information, Careers, employee access or contacting the team.",
      "public_clarification",
      {
        confidence: 0.35,
        suggestions: [
          "What services do you offer?",
          "Contact SecureMedy",
          "Careers",
        ],
        actions: [
          action("services", "Explore Services", PUBLIC_LINKS.services),
          action("contact", "Contact SecureMedy", PUBLIC_LINKS.contact),
        ],
      },
    );
  }
}
