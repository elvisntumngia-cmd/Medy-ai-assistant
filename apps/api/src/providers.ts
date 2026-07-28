import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  LeadSchema,
  type AssistantAction,
  type DemoConfig,
  type DemoRole,
  type EmployeeProfile,
  type LeadInput,
} from "@medy/shared";

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

const dataFile = (environmentName: string, fileName: string) =>
  process.env[environmentName] ||
  path.resolve(
    fs.existsSync(path.resolve(process.cwd(), "data"))
      ? process.cwd()
      : path.resolve(process.cwd(), "../.."),
    `data/${fileName}`,
  );
const readArray = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
};
const writeArray = (file: string, value: unknown[]) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

export class LocalLeadProvider {
  constructor(public file = dataFile("MEDY_LEADS_FILE", "leads.json")) {}
  create(value: LeadInput) {
    const lead = {
      ...LeadSchema.parse(value),
      id: `MEDY-${Date.now().toString().slice(-7)}`,
      status: "New",
      createdAt: new Date().toISOString(),
    };
    writeArray(this.file, [lead, ...readArray(this.file)]);
    return lead;
  }
  list() {
    return readArray(this.file);
  }
  get(id: string) {
    return readArray(this.file).find((item: { id: string }) => item.id === id);
  }
  reset() {
    writeArray(this.file, []);
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
  constructor(public file = dataFile("MEDY_ACTIONS_FILE", "actions.json")) {}
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
    writeArray(this.file, [record, ...readArray(this.file)]);
    return { status: 201, record };
  }
  list() {
    return readArray(this.file);
  }
  reset() {
    writeArray(this.file, []);
  }
}
