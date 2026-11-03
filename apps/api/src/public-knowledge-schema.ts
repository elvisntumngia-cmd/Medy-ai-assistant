import { z } from "zod";

export const PUBLIC_LINKS = {
  home: "https://new.securemedy.com/",
  about: "https://new.securemedy.com/about/",
  services: "https://new.securemedy.com/services/",
  physicalSecurity: "https://new.securemedy.com/services/security-personnel/",
  electronicSecurity: "https://new.securemedy.com/services/security-technology/",
  riskManagement: "https://new.securemedy.com/services/risk-management/",
  personnelSecurity: "https://new.securemedy.com/services/security-personnel/",
  emergencyManagement: "https://new.securemedy.com/services/security-consulting/",
  concierge: "https://new.securemedy.com/services/security-personnel/",
  industries: "https://new.securemedy.com/industries/",
  careers: "https://new.securemedy.com/careers/",
  contact: "https://new.securemedy.com/contact/",
  privacy: "https://new.securemedy.com/privacy/",
  terms: "https://new.securemedy.com/terms/",
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
