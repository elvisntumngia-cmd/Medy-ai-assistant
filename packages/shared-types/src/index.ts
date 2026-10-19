import { companyCopy, extractPublicLinks } from "./browser.js";
import { z } from "zod";

export const ModeSchema = z.enum(["public", "employee"]);
export type Mode = z.infer<typeof ModeSchema>;
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
  url: z.string().url().optional(),
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
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
export const ChatRequestSchema = z.object({
  mode: ModeSchema,
  messages: z.array(MessageSchema).min(1).max(100),
  provider: z.enum(["mock", "bedrock"]).optional(),
  conversationId: z.string().min(8).max(120).optional(),
  triggerError: z.boolean().optional(),
});
export const LeadSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    organization: z.string().trim().max(150).default(""),
    email: z.union([z.string().trim().email(), z.literal("")]).default(""),
    phone: z
      .union([z.string().regex(/^[+()\-\s\d]{7,20}$/), z.literal("")])
      .default(""),
    serviceLocation: z.string().trim().min(2).max(150),
    propertyType: z.string().trim().min(2).max(150),
    requestedService: z.string().trim().min(2).max(150),
    armedPreference: z.enum(["Armed", "Unarmed", "Not sure"]),
    officerCount: z.coerce.number().int().positive().max(500),
    coverageSchedule: z.string().trim().min(2).max(150),
    desiredStartDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
    additionalDetails: z.string().max(1000).default(""),
    preferredContactMethod: z.enum(["Email", "Phone"]),
    consent: z.literal(true),
  })
  .refine(
    (value) =>
      value.preferredContactMethod === "Email" ? !!value.email : !!value.phone,
    {
      message: "Provide the selected contact method.",
      path: ["preferredContactMethod"],
    },
  );
export type LeadInput = z.infer<typeof LeadSchema>;
export const DemoConfigSchema = z.object({
  role: RoleSchema.default("officer"),
  provider: z.enum(["mock", "bedrock"]).default("mock"),
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

/** One visible control per destination; keep the requested navigation button over a duplicate citation. */
export function presentResponse(
  response: AssistantResponse,
): AssistantResponse {
  const linked = extractPublicLinks(response.message);
  response = {
    ...response,
    message: linked.message,
    actions: [...response.actions, ...linked.actions].map((action) => ({
      ...action,
      label: companyCopy(action.label),
    })),
  };
  const destinations = new Set<string>();
  const ids = new Set<string>();
  const actions = response.actions.filter((action) => {
    const key = action.type + ":" + (action.target || action.id);
    if (ids.has(key)) return false;
    ids.add(key);
    if (action.target) destinations.add(action.target.replace(/\/$/, ""));
    return true;
  });
  const sourceIds = new Set<string>();
  const sources = response.sources.filter((source) => {
    const key = source.url?.replace(/\/$/, "") || source.id;
    if (destinations.has(key) || sourceIds.has(key)) return false;
    sourceIds.add(key);
    return true;
  });
  return { ...response, actions, sources };
}

export * from "./browser.js";
