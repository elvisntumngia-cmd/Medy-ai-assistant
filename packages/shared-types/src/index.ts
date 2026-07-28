import { z } from "zod";

export const ModeSchema = z.enum(["public", "employee"]);
export type Mode = z.infer<typeof ModeSchema>;
export const KnowledgeStatusSchema = z.enum([
  "approved",
  "provisional",
  "demo_only",
  "requires_confirmation",
]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;
export const RoleSchema = z.enum(["officer", "manager", "hr_admin"]);
export type DemoRole = z.infer<typeof RoleSchema>;

export const PortalRoutes = {
  dashboard: "/dashboard",
  assistant: "/assistant",
  forms: "/form",
  approvals: "/approvals",
  inbox: "/documentation-inbox",
  externalLinks: "/external-links",
  resources: "/resources/document-library",
  employees: "/employee-management",
  uniformInventory: "/inventory-management?category=Uniform",
  profile: "/profile",
  settings: "/settings",
  uniformRequest: "/forms/logistics-inventory/uniform-request-cart",
} as const;
export const routes = PortalRoutes;

export const ActionTypeSchema = z.enum([
  "navigate",
  "open_external",
  "show_data",
  "start_form",
  "submit_mock_request",
  "contact_department",
  "escalate",
]);
export const ActionSchema = z.object({
  id: z.string().min(1),
  type: ActionTypeSchema,
  label: z.string().min(1),
  target: z.string().optional(),
  requiresConfirmation: z.boolean().default(false),
  data: z.record(z.unknown()).optional(),
});
export type AssistantAction = z.infer<typeof ActionSchema>;
export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: ModeSchema,
  snippet: z.string(),
  label: z.string().optional(),
  status: KnowledgeStatusSchema.optional(),
});
export const AssistantResponseSchema = z.object({
  message: z.string(),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  actions: z.array(ActionSchema).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  escalation: z.string().nullable().default(null),
  data: z
    .union([z.record(z.unknown()), z.array(z.record(z.unknown()))])
    .optional(),
  sources: z.array(SourceSchema).default([]),
  alternativeIntents: z.array(z.string()).default([]),
  matchingKnowledgeEntryIds: z.array(z.string()).default([]),
  disclaimer: z.string().optional(),
  missingRequiredFields: z.array(z.string()).default([]),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
export const ChatRequestSchema = z.object({
  mode: ModeSchema,
  messages: z.array(MessageSchema).min(1),
  provider: z.literal("mock").optional(),
  conversationId: z.string().min(1).max(100).optional(),
  triggerError: z.boolean().optional(),
});
export const LeadSchema = z.object({
  fullName: z.string().min(2),
  organization: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^[+()\-\s\d]{7,20}$/),
  serviceLocation: z.string().min(2),
  propertyType: z.string().min(2),
  requestedService: z.string().min(2),
  armedPreference: z.enum(["Armed", "Unarmed", "Not sure"]),
  officerCount: z.coerce.number().int().positive().max(500),
  coverageSchedule: z.string().min(2),
  desiredStartDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  additionalDetails: z.string().max(1000).default(""),
  preferredContactMethod: z.enum(["Email", "Phone"]),
  consent: z.literal(true),
});
export type LeadInput = z.infer<typeof LeadSchema>;
export const DemoConfigSchema = z.object({
  role: RoleSchema.default("officer"),
  provider: z.literal("mock").default("mock"),
  delay: z.boolean().default(false),
  providerError: z.boolean().default(false),
});
export type DemoConfig = z.infer<typeof DemoConfigSchema>;
export type EmployeeProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleKey: DemoRole;
  department: string;
  manager: string;
  site: string;
  email: string;
  permissions: string[];
};
