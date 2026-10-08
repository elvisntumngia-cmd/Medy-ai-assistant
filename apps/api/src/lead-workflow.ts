import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import pg from "pg";

const { Pool } = pg;

export const ConversationalLeadInputSchema = z
  .object({
    visitorName: z.string().trim().min(2).max(100),
    companyName: z.string().trim().max(150).optional(),
    email: z.string().trim().email().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[+()\-\s\d]{7,20}$/)
      .optional(),
    preferredContactMethod: z.enum(["email", "phone", "either"]),
    serviceCategory: z.string().trim().min(2).max(100),
    facilityType: z.string().trim().max(100).optional(),
    serviceLocation: z.string().trim().max(150).optional(),
    requirementsSummary: z.string().trim().min(2).max(1000),
    desiredStart: z.string().trim().max(100).optional(),
    sourcePage: z.string().url().optional(),
    consent: z.literal(true),
  })
  .refine((value) => value.email || value.phone, {
    message: "Provide an email address or phone number.",
    path: ["email"],
  });
export type ConversationalLeadInput = z.infer<
  typeof ConversationalLeadInputSchema
>;

export type LeadRecord = ConversationalLeadInput & {
  id: string;
  source: "medy_public";
  createdAt: string;
  updatedAt: string;
  consentTimestamp: string;
  leadStatus: "new";
  notificationStatus: "pending" | "simulated" | "sent" | "failed";
  notificationAttempts: number;
  notificationLastError?: string;
  persistence: "postgres" | "local_simulation" | "memory_test";
};

export interface LeadRepository {
  readonly persistence: LeadRecord["persistence"];
  create(value: ConversationalLeadInput): Promise<LeadRecord>;
  findRecentDuplicate(
    value: ConversationalLeadInput,
  ): Promise<LeadRecord | null>;
  updateNotification(
    id: string,
    status: LeadRecord["notificationStatus"],
    error?: string,
  ): Promise<void>;
}

const newRecord = (
  value: ConversationalLeadInput,
  persistence: LeadRecord["persistence"],
): LeadRecord => {
  const now = new Date().toISOString();
  return {
    ...value,
    id: `MEDY-${crypto.randomUUID()}`,
    source: "medy_public",
    createdAt: now,
    updatedAt: now,
    consentTimestamp: now,
    leadStatus: "new",
    notificationStatus: "pending",
    notificationAttempts: 0,
    persistence,
  };
};

const duplicateKey = (value: ConversationalLeadInput) =>
  `${value.email?.toLowerCase() || ""}|${value.phone?.replace(/\D/g, "") || ""}|${value.serviceCategory.toLowerCase()}`;

export class MemoryLeadRepository implements LeadRepository {
  readonly persistence = "memory_test" as const;
  records: LeadRecord[] = [];
  async findRecentDuplicate(value: ConversationalLeadInput) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (
      this.records.find(
        (record) =>
          Date.parse(record.createdAt) >= cutoff &&
          duplicateKey(record) === duplicateKey(value),
      ) || null
    );
  }
  async create(value: ConversationalLeadInput) {
    const record = newRecord(value, this.persistence);
    this.records.unshift(record);
    return record;
  }
  async updateNotification(
    id: string,
    status: LeadRecord["notificationStatus"],
    error?: string,
  ) {
    const record = this.records.find((item) => item.id === id);
    if (!record) return;
    record.notificationStatus = status;
    record.notificationAttempts += 1;
    record.notificationLastError = error;
    record.updatedAt = new Date().toISOString();
  }
}

export class FileLeadRepository implements LeadRepository {
  readonly persistence = "local_simulation" as const;
  constructor(
    private file = process.env.MEDY_CONVERSATIONAL_LEADS_FILE ||
      path.resolve(process.cwd(), "data/conversational-leads.json"),
  ) {}
  private read(): LeadRecord[] {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return [];
    }
  }
  private write(records: LeadRecord[]) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(records, null, 2));
  }
  async findRecentDuplicate(value: ConversationalLeadInput) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (
      this.read().find(
        (record) =>
          Date.parse(record.createdAt) >= cutoff &&
          duplicateKey(record) === duplicateKey(value),
      ) || null
    );
  }
  async create(value: ConversationalLeadInput) {
    const record = newRecord(value, this.persistence);
    this.write([record, ...this.read()]);
    return record;
  }
  async updateNotification(
    id: string,
    status: LeadRecord["notificationStatus"],
    error?: string,
  ) {
    const records = this.read();
    const record = records.find((item) => item.id === id);
    if (!record) return;
    record.notificationStatus = status;
    record.notificationAttempts += 1;
    record.notificationLastError = error;
    record.updatedAt = new Date().toISOString();
    this.write(records);
  }
}

export class PostgresLeadRepository implements LeadRepository {
  readonly persistence = "postgres" as const;
  private pool: pg.Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl:
        process.env.PGSSL === "false"
          ? false
          : {
              rejectUnauthorized:
                process.env.PGSSL_REJECT_UNAUTHORIZED !== "false",
            },
    });
  }
  async findRecentDuplicate(value: ConversationalLeadInput) {
    const result = await this.pool.query<LeadRecord>(
      `select id, source, source_page as "sourcePage", visitor_name as "visitorName",
       company_name as "companyName", email, phone,
       preferred_contact_method as "preferredContactMethod",
       service_category as "serviceCategory", facility_type as "facilityType",
       service_location as "serviceLocation", requirements_summary as "requirementsSummary",
       desired_start as "desiredStart", consent_status as consent,
       consent_timestamp as "consentTimestamp", lead_status as "leadStatus",
       notification_status as "notificationStatus", notification_attempts as "notificationAttempts",
       notification_last_error as "notificationLastError", created_at as "createdAt",
       updated_at as "updatedAt", 'postgres' as persistence
       from medy_public_leads
       where created_at >= now() - interval '24 hours'
       and coalesce(lower(email), '') = coalesce(lower($1), '')
       and coalesce(regexp_replace(phone, '\\D', '', 'g'), '') = coalesce(regexp_replace($2, '\\D', '', 'g'), '')
       and lower(service_category) = lower($3)
       order by created_at desc limit 1`,
      [value.email || null, value.phone || null, value.serviceCategory],
    );
    return result.rows[0] || null;
  }
  async create(value: ConversationalLeadInput) {
    const record = newRecord(value, this.persistence);
    await this.pool.query(
      `insert into medy_public_leads
       (id, source, source_page, visitor_name, company_name, email, phone,
        preferred_contact_method, service_category, facility_type, service_location,
        requirements_summary, desired_start, consent_status, consent_timestamp,
        lead_status, notification_status, notification_attempts, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        record.id,
        record.source,
        record.sourcePage || null,
        record.visitorName,
        record.companyName || null,
        record.email || null,
        record.phone || null,
        record.preferredContactMethod,
        record.serviceCategory,
        record.facilityType || null,
        record.serviceLocation || null,
        record.requirementsSummary,
        record.desiredStart || null,
        record.consent,
        record.consentTimestamp,
        record.leadStatus,
        record.notificationStatus,
        record.notificationAttempts,
        record.createdAt,
        record.updatedAt,
      ],
    );
    return record;
  }
  async updateNotification(
    id: string,
    status: LeadRecord["notificationStatus"],
    error?: string,
  ) {
    await this.pool.query(
      `update medy_public_leads set notification_status=$2,
       notification_attempts=notification_attempts+1,
       notification_last_error=$3, updated_at=now() where id=$1`,
      [id, status, error || null],
    );
  }
}

export interface LeadNotificationProvider {
  notify(
    record: LeadRecord,
  ): Promise<{ delivered: boolean; simulated: boolean }>;
}

export class MockLeadNotificationProvider implements LeadNotificationProvider {
  async notify(_record: LeadRecord) {
    return { delivered: false, simulated: true };
  }
}

export class LeadWorkflow {
  constructor(
    readonly repository: LeadRepository,
    readonly notifications: LeadNotificationProvider,
  ) {}
  async submit(input: ConversationalLeadInput) {
    const parsed = ConversationalLeadInputSchema.parse(input);
    const duplicate = await this.repository.findRecentDuplicate(parsed);
    if (duplicate) return { record: duplicate, duplicate: true };
    const record = await this.repository.create(parsed);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const notification = await this.notifications.notify(record);
        const status = notification.simulated
          ? "simulated"
          : notification.delivered
            ? "sent"
            : "failed";
        await this.repository.updateNotification(record.id, status);
        record.notificationStatus = status;
        if (status !== "failed") break;
      } catch (error) {
        await this.repository.updateNotification(
          record.id,
          "failed",
          error instanceof Error
            ? error.message.slice(0, 250)
            : "Notification failed",
        );
        record.notificationStatus = "failed";
      }
    }
    return { record, duplicate: false };
  }
}

export const createLeadWorkflow = () =>
  new LeadWorkflow(
    process.env.DATABASE_URL
      ? new PostgresLeadRepository(process.env.DATABASE_URL)
      : new FileLeadRepository(),
    new MockLeadNotificationProvider(),
  );
