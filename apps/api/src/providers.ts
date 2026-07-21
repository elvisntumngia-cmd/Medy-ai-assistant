import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  AssistantResponseSchema,
  LeadSchema,
  PortalRoutes,
  type AssistantAction,
  type AssistantResponse,
  type DemoConfig,
  type DemoRole,
  type EmployeeProfile,
  type LeadInput,
  type Mode,
} from "@medy/shared";

export type KnowledgeMatch = {
  id: string;
  title: string;
  domain: Mode;
  snippet: string;
  score: number;
};
export interface KnowledgeProvider {
  search(mode: Mode, query: string): Promise<KnowledgeMatch[]>;
}
export interface AIProvider {
  chat(
    mode: Mode,
    messages: { role: string; content: string }[],
    context: KnowledgeMatch[],
    user?: EmployeeProfile,
  ): Promise<AssistantResponse>;
}
export interface AuthAdapter {
  getUser(sessionId?: string): Promise<EmployeeProfile | null>;
  getConfig(sessionId?: string): DemoConfig | null;
  setConfig(sessionId: string, value: DemoConfig): DemoConfig | null;
  reset(): void;
}

const profiles: Record<DemoRole, EmployeeProfile> = {
  officer: {
    id: "EMP-1007",
    firstName: "James",
    lastName: "Carter",
    role: "Security Officer",
    roleKey: "officer",
    department: "Operations",
    manager: "Patricia Johnson",
    site: "Washington DC",
    email: "james.carter@example.test",
    permissions: ["self_service", "submit_request"],
  },
  manager: {
    id: "EMP-1012",
    firstName: "Patricia",
    lastName: "Johnson",
    role: "Operations Manager",
    roleKey: "manager",
    department: "Operations",
    manager: "Regional Director",
    site: "Washington DC",
    email: "patricia.johnson@example.test",
    permissions: ["self_service", "submit_request", "review_approvals"],
  },
  hr_admin: {
    id: "EMP-1020",
    firstName: "Renee",
    lastName: "Brooks",
    role: "HR Administrator",
    roleKey: "hr_admin",
    department: "Human Resources",
    manager: "VP People",
    site: "Head Office",
    email: "renee.brooks@example.test",
    permissions: ["self_service", "employee_support", "view_compliance"],
  },
};
export const employee = profiles.officer;
const defaults: DemoConfig = {
  role: "officer",
  provider: "mock",
  delay: false,
  providerError: false,
};
const initialSessions = () =>
  new Map<string, DemoConfig>([
    ["stakeholder-demo", { ...defaults }],
    ["demo-officer", { ...defaults, role: "officer" }],
    ["demo-manager", { ...defaults, role: "manager" }],
    ["demo-hr-admin", { ...defaults, role: "hr_admin" }],
  ]);
let sessions = initialSessions();
export class MockAuthAdapter implements AuthAdapter {
  getConfig(id?: string) {
    return id ? sessions.get(id) || null : null;
  }
  setConfig(id: string, value: DemoConfig) {
    if (!sessions.has(id)) return null;
    sessions.set(id, value);
    return value;
  }
  async getUser(id?: string) {
    const config = this.getConfig(id);
    return config ? profiles[config.role] || null : null;
  }
  reset() {
    sessions = initialSessions();
  }
}

export class LocalKnowledgeProvider implements KnowledgeProvider {
  constructor(
    private root = fs.existsSync(path.resolve(process.cwd(), "knowledge"))
      ? path.resolve(process.cwd(), "knowledge")
      : path.resolve(process.cwd(), "../../knowledge"),
  ) {}
  async search(mode: Mode, query: string) {
    const terms = [
      ...new Set(query.toLowerCase().match(/[a-z0-9]+/g) || []),
    ].filter((x) => x.length > 2);
    const dir = path.join(this.root, mode);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((x) => x.endsWith(".md"))
      .map((file) => {
        const text = fs.readFileSync(path.join(dir, file), "utf8");
        const score = terms.reduce(
          (n, t) => n + (text.toLowerCase().split(t).length - 1),
          0,
        );
        return {
          id: file,
          title: text.match(/^# (.+)$/m)?.[1] || file,
          domain: mode,
          snippet: text
            .replace(/^# .+$/m, "")
            .trim()
            .slice(0, 420),
          score,
        };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}

const make = (
  message: string,
  intent: string,
  actions: AssistantAction[] = [],
  data?: Record<string, unknown> | Record<string, unknown>[],
  sources: KnowledgeMatch[] = [],
  suggestedQuestions: string[] = [],
) =>
  AssistantResponseSchema.parse({
    message,
    intent,
    confidence: 0.9,
    actions,
    data,
    sources: sources.map(({ id, title, domain, snippet }) => ({
      id,
      title,
      domain,
      snippet,
    })),
    suggestedQuestions,
    escalation: null,
  });
export class MockAIProvider implements AIProvider {
  async chat(
    mode: Mode,
    messages: { role: string; content: string }[],
    context: KnowledgeMatch[],
    user?: EmployeeProfile,
  ) {
    const q = messages.at(-1)!.content.toLowerCase();
    if (mode === "public") {
      if (/payroll|uniform|employee|approval/.test(q))
        return make(
          "Employee information requires an authenticated M3dyHub demo session.",
          "restricted",
        );
      if (/emergency|danger|911/.test(q))
        return make(
          "Medy Assistant cannot dispatch emergency services. If anyone is in immediate danger, call 911 or the appropriate local emergency number.",
          "emergency",
          [],
          undefined,
          context,
        );
      if (/career|job|apply/.test(q))
        return make(
          "Explore SecureMedy career opportunities using the approved careers destination.",
          "careers",
          [
            {
              id: "careers",
              type: "open_external",
              label: "View Careers",
              target: "https://securemedy.com/careers",
              requiresConfirmation: false,
            },
          ],
          undefined,
          context,
        );
      if (/contact|someone|person|handoff/.test(q))
        return make(
          "I can collect your contact details for a demonstration handoff.",
          "contact",
          [
            {
              id: "contact",
              type: "start_form",
              label: "Contact SecureMedy",
              requiresConfirmation: false,
            },
            {
              id: "handoff",
              type: "escalate",
              label: "Speak with Someone",
              requiresConfirmation: false,
            },
          ],
          undefined,
          context,
        );
      if (/service|security|guard|officer|quote|protect/.test(q))
        return make(
          "SecureMedy offers security support tailored to organizations and properties. A representative must confirm scope and availability.",
          "services",
          [
            {
              id: "lead",
              type: "start_form",
              label: "Request Security Services",
              requiresConfirmation: false,
            },
          ],
          undefined,
          context,
          ["What industries are served?", "Speak with someone"],
        );
      if (context[0])
        return make(
          context[0].snippet,
          "knowledge_answer",
          [],
          undefined,
          context,
        );
      return make(
        "I can help with services, industries, careers, contact options, or a security service request.",
        "public_fallback",
        [],
        undefined,
        context,
        ["Explore services", "Request security services", "Careers"],
      );
    }
    if (!user)
      return make("An employee demo identity is required.", "unauthenticated");
    const nav = (
      id: string,
      label: string,
      target: string,
    ): AssistantAction => ({
      id,
      type: "navigate",
      label,
      target,
      requiresConfirmation: false,
    });
    if (/uniform|shirt|pants|size/.test(q))
      return make(
        "Use the Uniform Request workflow for new issue, replacement, damage, or size change.",
        "uniform_request",
        [nav("uniform", "Open Uniform Request", PortalRoutes.uniformRequest)],
        { id: "UNI-311", status: "Processing" },
        context,
      );
    if (/pay|overtime|timesheet|wage/.test(q))
      return make(
        "Review the affected pay period and submit a payroll issue. Payroll must confirm any correction.",
        "payroll_issue",
        [
          {
            id: "payroll",
            type: "submit_mock_request",
            label: "Start Payroll Issue",
            requiresConfirmation: true,
          },
          {
            id: "payroll-contact",
            type: "contact_department",
            label: "Contact Payroll",
            target: "Payroll",
            requiresConfirmation: false,
          },
        ],
        { id: "PAY-883", status: "Open" },
        context,
      );
    if (/radio|equipment|vest|device|lost/.test(q))
      return make(
        "Report the item promptly and notify your supervisor. This demonstration does not assign fault.",
        "equipment_problem",
        [
          {
            id: "lost-equipment",
            type: "submit_mock_request",
            label: "Report Lost Equipment",
            requiresConfirmation: true,
          },
          nav(
            "equipment-policy",
            "View Equipment Policy",
            PortalRoutes.resources,
          ),
        ],
        undefined,
        context,
      );
    if (/license|guard card|expir|renew/.test(q))
      return make(
        "Your mock credential expires September 18, 2026. Confirm renewal requirements with HR/Compliance and official state guidance.",
        "license_expiration",
        [
          {
            id: "license",
            type: "show_data",
            label: "View License Details",
            requiresConfirmation: false,
          },
          nav("resources", "Open Resource Library", PortalRoutes.resources),
        ],
        { expires: "2026-09-18" },
        context,
      );
    if (/approval/.test(q))
      return make(
        `${user.firstName}, you have two mock approvals awaiting review.`,
        "approvals",
        [nav("approvals", "Open Approvals", PortalRoutes.approvals)],
        undefined,
        context,
      );
    if (/leave|pto|vacation|time off/.test(q))
      return make(
        "Your mock leave request is pending manager review. Confirm requirements with HR.",
        "leave",
        [nav("forms", "Open Forms", PortalRoutes.forms)],
        undefined,
        context,
      );
    if (/training|course/.test(q))
      return make(
        "You have two assigned demonstration courses; one is overdue.",
        "training",
        [],
        undefined,
        context,
      );
    if (/it|password|access|login|system/.test(q))
      return make(
        "For portal access or IT support, use the approved support channel. Never share your password with Medy Assistant.",
        "it_support",
        [
          {
            id: "it",
            type: "contact_department",
            label: "Contact IT Support",
            target: "IT Support",
            requiresConfirmation: false,
          },
        ],
        undefined,
        context,
      );
    if (/hr|human resources|benefit/.test(q))
      return make(
        "I can help route an HR question, but official guidance must come from Human Resources.",
        "hr",
        [
          {
            id: "hr",
            type: "contact_department",
            label: "Contact HR",
            target: "Human Resources",
            requiresConfirmation: false,
          },
        ],
        undefined,
        context,
      );
    if (
      /schedule|shift|operations|finance|self service|resource|policy|sop|attendance/.test(
        q,
      ) &&
      context[0]
    )
      return make(
        `DEMONSTRATION CONTENT — NOT AN OFFICIAL SECUREMEDY POLICY\n\n${context[0].snippet}`,
        "knowledge_answer",
        [nav("resources", "Open Resource Library", PortalRoutes.resources)],
        undefined,
        context,
      );
    return make(
      "I’m not fully certain which area you need. Is this payroll, HR, scheduling, uniforms, equipment, training, IT, approvals, or resources?",
      "employee_fallback",
      [],
      undefined,
      context,
      ["Payroll", "Uniforms", "Training", "IT Support"],
    );
  }
}

export class BedrockAIProvider implements AIProvider {
  async chat(
    mode: Mode,
    messages: { role: string; content: string }[],
    context: KnowledgeMatch[],
  ) {
    const region = process.env.AWS_REGION;
    const modelId = process.env.BEDROCK_MODEL_ID;
    if (!region || !modelId)
      throw new Error("Bedrock configuration is incomplete");
    const client = new BedrockRuntimeClient({ region });
    const prompt = JSON.stringify({
      mode,
      messages,
      context,
      contract: "Return only the Medy Assistant JSON response contract.",
    });
    const result = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(JSON.stringify({ prompt })),
      }),
    );
    const raw = new TextDecoder().decode(result.body);
    const outer = JSON.parse(raw);
    const candidate =
      typeof outer.completion === "string"
        ? JSON.parse(outer.completion)
        : outer;
    return AssistantResponseSchema.parse(candidate);
  }
}

export class LocalLeadProvider {
  constructor(
    public file = process.env.MEDY_LEADS_FILE ||
      path.resolve(
        fs.existsSync(path.resolve(process.cwd(), "data"))
          ? process.cwd()
          : path.resolve(process.cwd(), "../.."),
        "data/leads.json",
      ),
  ) {}
  private read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return [];
    }
  }
  private write(v: unknown[]) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(v, null, 2));
  }
  create(v: LeadInput) {
    const lead = {
      ...LeadSchema.parse(v),
      id: `MEDY-${Date.now().toString().slice(-7)}`,
      status: "New",
      createdAt: new Date().toISOString(),
    };
    this.write([lead, ...this.read()]);
    return lead;
  }
  list() {
    return this.read();
  }
  get(id: string) {
    return this.read().find((x: { id: string }) => x.id === id);
  }
  reset() {
    this.write([]);
  }
}
export const employeeData = (user: EmployeeProfile) => ({
  profile: user,
  leave: { id: "LV-1042", status: "Pending manager review" },
  requests: [
    { id: "PAY-883", type: "Payroll", status: "Open" },
    { id: "UNI-311", type: "Uniform", status: "Processing" },
  ],
  training: [
    { title: "Annual De-escalation", status: "Due soon" },
    { title: "Cybersecurity Awareness", status: "Overdue" },
  ],
  approvals: user.permissions.includes("review_approvals")
    ? [
        { id: "APR-204", employee: "Taylor Reed" },
        { id: "APR-205", employee: "Morgan Lee" },
      ]
    : [],
  uniform: { id: "UNI-311", status: "Processing" },
  equipment: { id: "EQ-174", status: "Supervisor review" },
  license: { type: "DC Special Police Officer", expires: "2026-09-18" },
  recent: [
    { id: "LV-1042", type: "Leave" },
    { id: "PAY-883", type: "Payroll" },
  ],
});
export const approvedActions = new Set([
  "uniform",
  "payroll",
  "payroll-contact",
  "lost-equipment",
  "equipment-policy",
  "license",
  "resources",
  "approvals",
  "forms",
  "it",
  "hr",
  "contact",
  "handoff",
  "careers",
  "lead",
]);
export class MockActionProvider {
  constructor(
    public file = process.env.MEDY_ACTIONS_FILE ||
      path.resolve(
        fs.existsSync(path.resolve(process.cwd(), "data"))
          ? process.cwd()
          : path.resolve(process.cwd(), "../.."),
        "data/actions.json",
      ),
  ) {}
  private read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return [];
    }
  }
  execute(action: AssistantAction, user: EmployeeProfile, confirmed: boolean) {
    if (!approvedActions.has(action.id))
      return { status: 403, error: "Action is not approved" };
    if (action.requiresConfirmation && !confirmed)
      return { status: 409, error: "Confirmation required" };
    const record = {
      actionId: action.id,
      actor: user.id,
      role: user.role,
      timestamp: new Date().toISOString(),
      actionType: action.type,
      target: action.target || null,
      result: "simulated",
      correlationId: crypto.randomUUID(),
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      this.file,
      JSON.stringify([record, ...this.read()], null, 2),
    );
    return { status: 201, record };
  }
  list() {
    return this.read();
  }
  reset() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, "[]");
  }
}
