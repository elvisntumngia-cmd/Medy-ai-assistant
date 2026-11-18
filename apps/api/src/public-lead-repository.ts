import crypto from "node:crypto";
import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LeadInput } from "@medy/shared";
import { LocalLeadProvider } from "./providers.js";

export type PublicLeadRecord = LeadInput & {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};
export interface PublicLeadRepository {
  readonly persistence: "dynamodb" | "local_simulation";
  create(value: LeadInput): Promise<PublicLeadRecord>;
  get(id: string): Promise<PublicLeadRecord | undefined>;
  list?(): Promise<PublicLeadRecord[]>;
  reset?(): Promise<void>;
}

export class LocalPublicLeadRepository implements PublicLeadRepository {
  readonly persistence = "local_simulation" as const;
  constructor(readonly local = new LocalLeadProvider()) {}
  async create(value: LeadInput) { return this.local.create(value) as PublicLeadRecord; }
  async get(id: string) { return this.local.get(id) as PublicLeadRecord | undefined; }
  async list() { return this.local.list() as PublicLeadRecord[]; }
  async reset() { this.local.reset(); }
}

const duplicateId = (value: LeadInput) => crypto.createHash("sha256").update([
  value.email.toLowerCase(), value.phone.replace(/\D/g, ""),
  value.requestedService.toLowerCase(), new Date().toISOString().slice(0, 10),
].join("|")).digest("hex").slice(0, 40);

export class DynamoPublicLeadRepository implements PublicLeadRepository {
  readonly persistence = "dynamodb" as const;
  constructor(
    private document: DynamoDBDocumentClient,
    private tableName: string,
    private retentionDays = 30,
  ) {
    if (!tableName) throw new Error("MEDY_LEADS_TABLE is required");
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90)
      throw new Error("MEDY_LEAD_RETENTION_DAYS must be between 1 and 90");
  }
  async create(value: LeadInput) {
    const key = duplicateId(value);
    const now = new Date();
    const record: PublicLeadRecord & { ttl: number; duplicateKey: string } = {
      ...value,
      id: `MEDY-${crypto.randomUUID()}`,
      status: "New",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.retentionDays * 86400000).toISOString(),
      ttl: Math.floor(now.getTime() / 1000) + this.retentionDays * 86400,
      duplicateKey: key,
    };
    try {
      await this.document.send(new PutCommand({
        TableName: this.tableName,
        Item: { ...record, pk: `DUP#${key}` },
        ConditionExpression: "attribute_not_exists(pk)",
      }));
      return record;
    } catch (error) {
      if ((error as { name?: string }).name !== "ConditionalCheckFailedException") throw error;
      const existing = await this.document.send(new GetCommand({
        TableName: this.tableName, Key: { pk: `DUP#${key}` }, ConsistentRead: true,
      }));
      if (!existing.Item) throw error;
      return existing.Item as PublicLeadRecord;
    }
  }
  async get(id: string) {
    // Public requests never expose this lookup. A future authenticated admin path should use a GSI.
    void id;
    return undefined;
  }
}

export function createPublicLeadRepository(config: DynamoDBClientConfig = {}): PublicLeadRepository {
  const awsProduction = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined || process.env.MEDY_AWS_PRODUCTION === "true";
  if (!awsProduction) return new LocalPublicLeadRepository();
  const table = process.env.MEDY_LEADS_TABLE?.trim();
  if (!table) throw new Error("AWS production requires MEDY_LEADS_TABLE");
  const retention = Number(process.env.MEDY_LEAD_RETENTION_DAYS || 30);
  return new DynamoPublicLeadRepository(
    DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION, ...config }), {
      marshallOptions: { removeUndefinedValues: true },
    }), table, retention,
  );
}
