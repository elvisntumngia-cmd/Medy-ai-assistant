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
  answer: z.string().min(1).max(2000),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1).max(240),
  verifiedAt: z.string().date(),
  visibility: z.literal("public"),
  reviewStatus: z.enum(["owner_approved", "website_verified", "dynamic"]),
  examples: z.array(z.string().max(300)).min(1).max(20),
  aliases: z.array(z.string().max(100)).max(50).default([]),
  action: z
    .object({ label: z.string().min(1), url: z.string().url() })
    .optional(),
  uncertainty: z.string().optional(),
});
export type PublicKnowledgeItem = z.infer<typeof PublicKnowledgeItemSchema>;
