import { z } from "zod";

export const PUBLIC_LINKS = {
  home: "https://securemedy.ng/",
  about: "https://securemedy.ng/about-us/",
  services: "https://securemedy.ng/services/",
  physicalSecurity: "https://securemedy.ng/service/physical-security/",
  electronicSecurity: "https://securemedy.ng/service/electronic-security/",
  riskManagement: "https://securemedy.ng/service/risk-management/",
  personnelSecurity: "https://securemedy.ng/service/personnel-security/",
  emergencyManagement: "https://securemedy.ng/service/emergency-management/",
  concierge: "https://securemedy.ng/service/concierge-services/",
  industries: "https://securemedy.ng/industries-served/",
  careers: "https://securemedy.ng/careers/",
  contact: "https://securemedy.ng/contact/",
  privacy: "https://securemedy.ng/privacy-policy/",
  terms: "https://securemedy.ng/terms/",
  employeePortal: "https://my.securemedy.com/",
} as const;

export const PublicKnowledgeItemSchema = z.object({
  id: z.string().min(1),
  topic: z.enum([
    "company",
    "services",
    "industries",
    "capabilities",
    "credentials",
    "contact",
    "careers",
    "employee-routing",
    "website-navigation",
    "public-resources",
  ]),
  answer: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1),
  verifiedAt: z.string().date(),
  visibility: z.literal("public"),
  reviewStatus: z.enum(["owner_approved", "website_verified", "dynamic"]),
  examples: z.array(z.string()).min(1),
  aliases: z.array(z.string()).default([]),
  action: z
    .object({ label: z.string().min(1), url: z.string().url() })
    .optional(),
  uncertainty: z.string().optional(),
});
export type PublicKnowledgeItem = z.infer<typeof PublicKnowledgeItemSchema>;

const verifiedAt = "2026-10-07";
const ownerApproved = {
  verifiedAt,
  visibility: "public" as const,
  reviewStatus: "owner_approved" as const,
};
const websiteVerified = {
  verifiedAt,
  visibility: "public" as const,
  reviewStatus: "website_verified" as const,
};

export const publicKnowledge = z.array(PublicKnowledgeItemSchema).parse([
  {
    id: "company-overview",
    topic: "company",
    answer:
      "SecureMedy Incorporated is a security and emergency-management services provider founded in 2009. It supports government agencies and commercial organizations with protective services and risk-management capabilities.",
    sourceUrl: PUBLIC_LINKS.about,
    sourceTitle: "About SecureMedy",
    examples: ["What is SecureMedy?", "Tell me about the company"],
    aliases: ["about securemedy", "company background", "who are you"],
    action: { label: "About SecureMedy", url: PUBLIC_LINKS.about },
    ...ownerApproved,
  },
  {
    id: "company-founded",
    topic: "company",
    answer: "SecureMedy Incorporated was founded in 2009.",
    sourceUrl: PUBLIC_LINKS.about,
    sourceTitle: "About SecureMedy",
    examples: ["When was SecureMedy founded?", "What year did you start?"],
    aliases: ["founded", "established", "started"],
    ...ownerApproved,
  },
  {
    id: "company-motto",
    topic: "company",
    answer:
      "SecureMedy's corporate motto is “On Time Response | Real Time Events.”",
    sourceUrl: PUBLIC_LINKS.about,
    sourceTitle: "About SecureMedy",
    examples: ["What's your motto?", "What is the corporate motto?"],
    aliases: ["motto", "slogan", "tagline"],
    ...ownerApproved,
  },
  {
    id: "mission-vision",
    topic: "company",
    answer:
      "SecureMedy's public materials describe a commitment to dependable security and emergency-management support for government and commercial clients. The exact current mission and vision statements should be read on the official About Us page.",
    sourceUrl: PUBLIC_LINKS.about,
    sourceTitle: "About SecureMedy",
    examples: ["What is your mission?", "Tell me about your vision"],
    aliases: ["mission", "vision", "company values"],
    action: { label: "About SecureMedy", url: PUBLIC_LINKS.about },
    uncertainty: "Use the official page for the current verbatim statements.",
    ...websiteVerified,
  },
  {
    id: "leadership",
    topic: "company",
    answer:
      "SecureMedy's public About Us page is the approved source for currently published leadership information. Medy will not infer or invent titles or personnel that are not in the approved public dataset.",
    sourceUrl: PUBLIC_LINKS.about,
    sourceTitle: "About SecureMedy",
    examples: ["Who leads SecureMedy?", "Who is the CEO?"],
    aliases: ["leadership", "management team", "chief executive"],
    action: { label: "About SecureMedy", url: PUBLIC_LINKS.about },
    uncertainty: "Leadership details can change.",
    ...websiteVerified,
  },
  {
    id: "company-licensing",
    topic: "credentials",
    answer:
      "SecureMedy is licensed in 16 states and counting. Licensing details can change, so the company should confirm coverage for a specific location and service.",
    sourceUrl: PUBLIC_LINKS.home,
    sourceTitle: "SecureMedy homepage",
    examples: ["What states do you serve?", "Are you licensed in my state?"],
    aliases: ["16 states", "states licensed", "service area", "coverage area"],
    action: { label: "Contact SecureMedy", url: PUBLIC_LINKS.contact },
    uncertainty: "Specific current state coverage requires confirmation.",
    ...ownerApproved,
  },
  {
    id: "company-contact",
    topic: "contact",
    answer:
      "SecureMedy's headquarters is 8507 Oxon Hill Road, Suite 101, Fort Washington, MD 20744. Call (240) 419-3125 or email info@securemedy.com.",
    sourceUrl: PUBLIC_LINKS.contact,
    sourceTitle: "Contact SecureMedy",
    examples: [
      "Where are you located?",
      "What's your phone number?",
      "How do I email you?",
    ],
    aliases: [
      "headquarters",
      "address",
      "located",
      "phone number",
      "telephone",
      "email address",
      "contact you",
    ],
    action: { label: "Contact SecureMedy", url: PUBLIC_LINKS.contact },
    ...ownerApproved,
  },
  {
    id: "services-overview",
    topic: "services",
    answer:
      "SecureMedy provides physical security, electronic security, risk management, personnel security, emergency management, concierge security, special-event security, executive protection, investigations and security consulting. Scope and availability are confirmed for each engagement.",
    sourceUrl: PUBLIC_LINKS.services,
    sourceTitle: "SecureMedy Services",
    examples: ["What services do you offer?", "How can SecureMedy help?"],
    aliases: ["services", "security solutions", "capabilities"],
    action: { label: "Explore Services", url: PUBLIC_LINKS.services },
    ...websiteVerified,
  },
  {
    id: "physical-security",
    topic: "services",
    answer:
      "Physical-security services include armed and unarmed personnel, access control and specialized patrol services. A representative must confirm staffing, licensing and availability for a particular assignment.",
    sourceUrl: PUBLIC_LINKS.physicalSecurity,
    sourceTitle: "Physical Security",
    examples: ["Do you provide armed guards?", "I need security officers"],
    aliases: [
      "physical security",
      "security guards",
      "security officers",
      "armed security",
      "unarmed security",
      "patrol",
    ],
    action: {
      label: "Physical Security",
      url: PUBLIC_LINKS.physicalSecurity,
    },
    ...websiteVerified,
  },
  {
    id: "electronic-security",
    topic: "services",
    answer:
      "Electronic-security services include CCTV design and installation, intrusion detection, access-control systems, remote monitoring, alarm-response coordination and system maintenance.",
    sourceUrl: PUBLIC_LINKS.electronicSecurity,
    sourceTitle: "Electronic Security",
    examples: ["Do you install cameras?", "We need CCTV and access control"],
    aliases: [
      "electronic security",
      "cctv",
      "cameras",
      "access control",
      "intrusion detection",
      "alarm",
    ],
    action: {
      label: "Electronic Security",
      url: PUBLIC_LINKS.electronicSecurity,
    },
    ...websiteVerified,
  },
  {
    id: "risk-management",
    topic: "services",
    answer:
      "Risk-management capabilities include vulnerability assessments, threat analysis and mitigation planning for government and commercial environments.",
    sourceUrl: PUBLIC_LINKS.riskManagement,
    sourceTitle: "Risk Management",
    examples: [
      "Can you assess our security risks?",
      "Do you perform threat assessments?",
    ],
    aliases: [
      "risk management",
      "risk assessment",
      "threat assessment",
      "vulnerability assessment",
    ],
    action: { label: "Risk Management", url: PUBLIC_LINKS.riskManagement },
    ...websiteVerified,
  },
  {
    id: "personnel-security",
    topic: "services",
    answer:
      "SecureMedy lists personnel security among its public services. The team can explain the available screening, suitability or personnel-risk support for a specific organization without discussing confidential procedures in chat.",
    sourceUrl: PUBLIC_LINKS.personnelSecurity,
    sourceTitle: "Personnel Security",
    examples: [
      "Do you provide personnel security?",
      "Can you help screen personnel?",
    ],
    aliases: [
      "personnel security",
      "background investigation",
      "personnel screening",
      "security clearance",
    ],
    action: {
      label: "Personnel Security",
      url: PUBLIC_LINKS.personnelSecurity,
    },
    ...websiteVerified,
  },
  {
    id: "specialized-services",
    topic: "services",
    answer:
      "SecureMedy's public service information includes special-event security, executive protection, investigations and security consulting. Scope, staffing and availability must be confirmed for each engagement.",
    sourceUrl: PUBLIC_LINKS.services,
    sourceTitle: "SecureMedy Services",
    examples: [
      "Do you provide event security?",
      "Do you offer executive protection?",
    ],
    aliases: [
      "event security",
      "executive protection",
      "investigations",
      "security consulting",
    ],
    action: { label: "Explore Services", url: PUBLIC_LINKS.services },
    ...websiteVerified,
  },
  {
    id: "emergency-management",
    topic: "services",
    answer:
      "Emergency-management services include continuity planning, disaster-response coordination, FEMA-aligned planning, crisis-communication protocols, exercises and after-action support. Medy cannot dispatch emergency help.",
    sourceUrl: PUBLIC_LINKS.emergencyManagement,
    sourceTitle: "Emergency Management",
    examples: [
      "Do you provide emergency planning?",
      "Can you help with continuity planning?",
    ],
    aliases: [
      "emergency management",
      "continuity planning",
      "disaster response",
      "coop plan",
    ],
    action: {
      label: "Emergency Management",
      url: PUBLIC_LINKS.emergencyManagement,
    },
    ...websiteVerified,
  },
  {
    id: "concierge-security",
    topic: "services",
    answer:
      "Concierge security combines front-of-house hospitality with visitor screening, access control, lobby coverage, VIP escort support and after-hours access coordination.",
    sourceUrl: PUBLIC_LINKS.concierge,
    sourceTitle: "Concierge Services",
    examples: ["Do you provide lobby security?", "What is concierge security?"],
    aliases: [
      "concierge",
      "lobby security",
      "front desk security",
      "security ambassador",
    ],
    action: { label: "Concierge Services", url: PUBLIC_LINKS.concierge },
    ...websiteVerified,
  },
  {
    id: "industries",
    topic: "industries",
    answer:
      "SecureMedy serves government, commercial real estate, healthcare, education, retail, industrial and logistics environments, critical infrastructure, and events and venues. Suitability depends on the specific location and requirements.",
    sourceUrl: PUBLIC_LINKS.industries,
    sourceTitle: "Industries Served",
    examples: ["What industries do you serve?", "Can you secure a hospital?"],
    aliases: [
      "industries",
      "hospital",
      "healthcare",
      "warehouse",
      "office",
      "school",
      "retail",
      "government",
    ],
    action: { label: "Industries Served", url: PUBLIC_LINKS.industries },
    ...websiteVerified,
  },
  {
    id: "careers",
    topic: "careers",
    answer:
      "Current opportunities and official application instructions are available on SecureMedy's Careers page. Medy cannot confirm vacancies, wages, application status or hiring decisions.",
    sourceUrl: PUBLIC_LINKS.careers,
    sourceTitle: "SecureMedy Careers",
    examples: [
      "Are you hiring?",
      "How do I apply?",
      "Can you check my application?",
    ],
    aliases: [
      "career",
      "job",
      "hiring",
      "apply",
      "application",
      "security position",
    ],
    action: { label: "View Careers", url: PUBLIC_LINKS.careers },
    uncertainty: "Open positions and application status are dynamic.",
    ...ownerApproved,
  },
  {
    id: "employee-portal",
    topic: "employee-routing",
    answer:
      "Current employees should use the secure employee portal for payroll, schedules, leave, training, HR and account support. Medy cannot access employee records or accept passwords or verification codes.",
    sourceUrl: PUBLIC_LINKS.employeePortal,
    sourceTitle: "SecureMedy employee portal",
    examples: [
      "I need my paystub",
      "Where is my schedule?",
      "I forgot my employee password",
    ],
    aliases: [
      "employee portal",
      "paystub",
      "payroll",
      "schedule",
      "leave",
      "training",
      "employee password",
      "contact hr",
    ],
    action: { label: "Employee Login", url: PUBLIC_LINKS.employeePortal },
    ...ownerApproved,
  },
  {
    id: "privacy",
    topic: "public-resources",
    answer:
      "SecureMedy's public Privacy Policy explains its published privacy practices. Do not provide passwords, access codes, banking information, government identification numbers or confidential security information in chat.",
    sourceUrl: PUBLIC_LINKS.privacy,
    sourceTitle: "SecureMedy Privacy Policy",
    examples: [
      "Where is your privacy policy?",
      "How is my information handled?",
    ],
    aliases: ["privacy", "privacy policy", "personal information"],
    action: { label: "Privacy Policy", url: PUBLIC_LINKS.privacy },
    ...websiteVerified,
  },
]);

export const publicKnowledgeById = new Map(
  publicKnowledge.map((item) => [item.id, item]),
);
