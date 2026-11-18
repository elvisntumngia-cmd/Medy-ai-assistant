import crypto from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { AIControlError } from "./public-ai-shared.js";

export const AssistantIdSchema = z.enum(["public", "medyhub"]);
export type AssistantId = z.infer<typeof AssistantIdSchema>;

export const PaidInferenceConfigSchema = z.object({
  tableName: z.string().min(1),
  assistantId: AssistantIdSchema,
  dailyRequests: z.coerce.number().int().positive().default(250),
  dailyTokens: z.coerce.number().int().positive().default(250000),
  monthlyAllocationMicros: z.coerce.number().int().positive(),
  sharedBufferMicros: z.coerce.number().int().nonnegative().default(2000000),
  monthlyCutoffMicros: z.coerce.number().int().positive(),
  warningMicros: z.array(z.number().int().positive()).default([6000000, 8000000]),
  inputUsdPerMillion: z.coerce.number().nonnegative().default(0.035),
  outputUsdPerMillion: z.coerce.number().nonnegative().default(0.14),
  retentionDays: z.coerce.number().int().min(32).max(800).default(400),
});
export type PaidInferenceConfig = z.infer<typeof PaidInferenceConfigSchema>;

export type InferenceReservation = {
  id: string;
  monthKey: string;
  dayKey: string;
  assistantId: AssistantId;
  reservedTokens: number;
  reservedCostMicros: number;
};

export interface PaidInferenceAccounting {
  reserve(inputTokens: number, maxOutputTokens: number): Promise<InferenceReservation>;
  settle(reservation: InferenceReservation, inputTokens: number, outputTokens: number): Promise<number>;
  fail(reservation: InferenceReservation, category: string): Promise<void>;
}

type DocumentClient = Pick<DynamoDBDocumentClient, "send">;
type MetadataLog = (value: Record<string, unknown>) => void;

export function estimatedCostMicros(
  inputTokens: number,
  outputTokens: number,
  config: Pick<PaidInferenceConfig, "inputUsdPerMillion" | "outputUsdPerMillion">,
) {
  return Math.ceil(inputTokens * config.inputUsdPerMillion + outputTokens * config.outputUsdPerMillion);
}

export class DynamoPaidInferenceAccounting implements PaidInferenceAccounting {
  constructor(
    private client: DocumentClient,
    private config: PaidInferenceConfig,
    private log: MetadataLog = (value) => console.info(JSON.stringify(value)),
    private now: () => Date = () => new Date(),
  ) {}

  async reserve(inputTokens: number, maxOutputTokens: number) {
    const now = this.now();
    const date = now.toISOString().slice(0, 10);
    const reservedTokens = inputTokens + maxOutputTokens;
    const reservedCostMicros = estimatedCostMicros(inputTokens, maxOutputTokens, this.config);
    const assistant = this.config.assistantId;
    const reservation: InferenceReservation = {
      id: crypto.randomUUID(),
      monthKey: `MONTH#${date.slice(0, 7)}`,
      dayKey: `DAY#${date}#${assistant}`,
      assistantId: assistant,
      reservedTokens,
      reservedCostMicros,
    };
    const expiresAt = Math.floor((now.getTime() + this.config.retentionDays * 86400000) / 1000);
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          { Update: {
            TableName: this.config.tableName,
            Key: { pk: reservation.monthKey },
            UpdateExpression: "SET expiresAt = :ttl, updatedAt = :now ADD estimatedCostMicros :cost, inFlight :one, requestCount :one, #assistantCost :cost, #assistantRequests :one",
            ConditionExpression: "(attribute_not_exists(estimatedCostMicros) OR estimatedCostMicros <= :totalBefore) AND (attribute_not_exists(#assistantCost) OR #assistantCost <= :assistantBefore)",
            ExpressionAttributeNames: {
              "#assistantCost": `${assistant}EstimatedCostMicros`,
              "#assistantRequests": `${assistant}RequestCount`,
            },
            ExpressionAttributeValues: {
              ":ttl": expiresAt,
              ":now": now.toISOString(),
              ":cost": reservedCostMicros,
              ":one": 1,
              ":totalBefore": this.config.monthlyCutoffMicros - reservedCostMicros,
              ":assistantBefore":
                this.config.monthlyAllocationMicros +
                this.config.sharedBufferMicros -
                reservedCostMicros,
            },
          } },
          { Update: {
            TableName: this.config.tableName,
            Key: { pk: reservation.dayKey },
            UpdateExpression: "SET expiresAt = :ttl, updatedAt = :now ADD requestCount :one, reservedTokens :tokens, inFlight :one",
            ConditionExpression: "(attribute_not_exists(requestCount) OR requestCount <= :requestsBefore) AND (attribute_not_exists(reservedTokens) OR reservedTokens <= :tokensBefore)",
            ExpressionAttributeValues: {
              ":ttl": expiresAt,
              ":now": now.toISOString(),
              ":one": 1,
              ":tokens": reservedTokens,
              ":requestsBefore": this.config.dailyRequests - 1,
              ":tokensBefore": this.config.dailyTokens - reservedTokens,
            },
          } },
        ],
        ClientRequestToken: reservation.id,
      }));
    } catch (error) {
      this.log({
        event: "ai_accounting_rejected",
        assistantId: assistant,
        errorCategory: (error as { name?: string }).name === "TransactionCanceledException"
          ? "budget_or_quota" : "accounting_unavailable",
      });
      throw new AIControlError(429, "AI_PAID_BUDGET");
    }
    await this.emitWarnings(reservation.monthKey);
    return reservation;
  }

  async settle(reservation: InferenceReservation, inputTokens: number, outputTokens: number) {
    const actualCost = estimatedCostMicros(inputTokens, outputTokens, this.config);
    const costDelta = actualCost - reservation.reservedCostMicros;
    const tokenDelta = inputTokens + outputTokens - reservation.reservedTokens;
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: this.config.tableName,
        Key: { pk: reservation.monthKey },
        UpdateExpression: "ADD estimatedCostMicros :costDelta, #assistantCost :costDelta, inFlight :minusOne, inputTokens :input, outputTokens :output, completedCount :one",
        ExpressionAttributeNames: { "#assistantCost": `${reservation.assistantId}EstimatedCostMicros` },
        ExpressionAttributeValues: { ":costDelta": costDelta, ":minusOne": -1, ":input": inputTokens, ":output": outputTokens, ":one": 1 },
      } },
      { Update: {
        TableName: this.config.tableName,
        Key: { pk: reservation.dayKey },
        UpdateExpression: "ADD reservedTokens :tokenDelta, inFlight :minusOne, inputTokens :input, outputTokens :output, completedCount :one",
        ExpressionAttributeValues: { ":tokenDelta": tokenDelta, ":minusOne": -1, ":input": inputTokens, ":output": outputTokens, ":one": 1 },
      } },
    ] }));
    return actualCost;
  }

  async fail(reservation: InferenceReservation, category: string) {
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Update: {
          TableName: this.config.tableName,
          Key: { pk: reservation.monthKey },
          UpdateExpression: "ADD inFlight :minusOne, failureCount :one",
          ExpressionAttributeValues: { ":minusOne": -1, ":one": 1 },
        } },
        { Update: {
          TableName: this.config.tableName,
          Key: { pk: reservation.dayKey },
          UpdateExpression: "ADD inFlight :minusOne, failureCount :one",
          ExpressionAttributeValues: { ":minusOne": -1, ":one": 1 },
        } },
      ] }));
    } catch {
      this.log({ event: "ai_accounting_failure", assistantId: reservation.assistantId, errorCategory: "failure_reconciliation" });
    }
    this.log({
      event: "ai_inference_failed",
      assistantId: reservation.assistantId,
      errorCategory: category,
      reservedTokens: reservation.reservedTokens,
      estimatedCostMicros: reservation.reservedCostMicros,
    });
  }

  private async emitWarnings(monthKey: string) {
    for (const threshold of this.config.warningMicros) {
      const attribute = `warning${threshold}At`;
      try {
        await this.client.send(new UpdateCommand({
          TableName: this.config.tableName,
          Key: { pk: monthKey },
          UpdateExpression: "SET #warning = :now",
          ConditionExpression: "estimatedCostMicros >= :threshold AND attribute_not_exists(#warning)",
          ExpressionAttributeNames: { "#warning": attribute },
          ExpressionAttributeValues: { ":threshold": threshold, ":now": this.now().toISOString() },
        }));
        this.log({ event: "ai_cost_warning", assistantId: this.config.assistantId, thresholdMicros: threshold });
      } catch (error) {
        if ((error as { name?: string }).name !== "ConditionalCheckFailedException")
          this.log({ event: "ai_accounting_failure", assistantId: this.config.assistantId, errorCategory: "warning_update" });
      }
    }
  }
}

export function paidInferenceConfig(): PaidInferenceConfig {
  const assistantId = AssistantIdSchema.parse(process.env.MEDY_ASSISTANT_ID || "public");
  const prefix = assistantId === "public" ? "PUBLIC" : "MEDYHUB";
  return PaidInferenceConfigSchema.parse({
    tableName: process.env.MEDY_INFERENCE_ACCOUNTING_TABLE,
    assistantId,
    dailyRequests: process.env[`${prefix}_DAILY_INFERENCE_REQUESTS`],
    dailyTokens: process.env[`${prefix}_DAILY_TOKEN_BUDGET`],
    monthlyAllocationMicros: Number(process.env[`${prefix}_MONTHLY_INFERENCE_USD`] || 4) * 1000000,
    sharedBufferMicros: Number(process.env.MEDY_SHARED_INFERENCE_BUFFER_USD || 2) * 1000000,
    monthlyCutoffMicros: Number(process.env.MEDY_MONTHLY_INFERENCE_CUTOFF_USD || 9) * 1000000,
    inputUsdPerMillion: process.env.AI_INPUT_USD_PER_MILLION,
    outputUsdPerMillion: process.env.AI_OUTPUT_USD_PER_MILLION,
    retentionDays: process.env.MEDY_ACCOUNTING_RETENTION_DAYS,
  });
}

export function configuredPaidInferenceAccounting() {
  const config = paidInferenceConfig();
  return new DynamoPaidInferenceAccounting(
    DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION })),
    config,
  );
}
