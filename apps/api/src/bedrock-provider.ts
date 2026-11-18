import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import type { Mode } from "@medy/shared";
import type { AIProvider, KnowledgeMatch } from "./providers.js";
import { PUBLIC_ASSISTANT_INSTRUCTIONS } from "./openai-provider.js";
import {
  AIControlError,
  estimateInputTokens,
  parsePublicModelResult,
  preparePublicRequest,
  safeFailure,
  validateAndMapPublicResult,
} from "./public-ai-shared.js";
import {
  configuredPaidInferenceAccounting,
  type PaidInferenceAccounting,
} from "./inference-accounting.js";

export const BedrockConfigSchema = z.object({
  region: z.string().min(1).default("us-east-1"),
  model: z.literal("amazon.nova-micro-v1:0").default("amazon.nova-micro-v1:0"),
  maxInput: z.coerce.number().int().min(1).max(2000).default(2000),
  history: z.coerce.number().int().min(1).max(20).default(10),
  maxOutput: z.coerce.number().int().min(1).max(2000).default(450),
  timeout: z.coerce.number().int().min(1).max(60000).default(15000),
  temperature: z.coerce.number().min(0).max(1).default(0.2),
});
export function bedrockConfig() {
  return BedrockConfigSchema.parse({
    region: process.env.AWS_REGION,
    model: process.env.BEDROCK_MODEL_ID,
    maxInput: process.env.AI_MAX_INPUT_LENGTH,
    history: process.env.AI_HISTORY_MESSAGES,
    maxOutput: process.env.AI_MAX_OUTPUT_TOKENS,
    timeout: process.env.AI_TIMEOUT_MS,
    temperature: process.env.AI_TEMPERATURE,
  });
}

export type ConverseClient = { send(command: ConverseCommand, options?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput> };

export class BedrockPublicProvider implements AIProvider {
  constructor(
    private client: ConverseClient,
    private config = bedrockConfig(),
    private accounting: PaidInferenceAccounting,
    private log: (value: Record<string, unknown>) => void = (value) => console.info(JSON.stringify(value)),
  ) {}

  async chat(mode: Mode, messages: { role: string; content: string }[], _context: KnowledgeMatch[]) {
    if (mode !== "public") throw new AIControlError(400, "PUBLIC_ONLY");
    const request = preparePublicRequest(messages, {
      maxInput: this.config.maxInput,
      history: this.config.history,
      instructions: PUBLIC_ASSISTANT_INSTRUCTIONS,
    });
    if (request.boundary) return request.boundary;
    const reservation = await this.accounting.reserve(
      estimateInputTokens(request.system + JSON.stringify(request.history)),
      this.config.maxOutput,
    );
    const input: ConverseCommandInput = {
      modelId: this.config.model,
      system: [{ text: request.system }],
      messages: request.history.map((message) => ({
        role: message.role,
        content: [{ text: message.content }],
      })),
      inferenceConfig: {
        maxTokens: this.config.maxOutput,
        temperature: this.config.temperature,
      },
    };
    let reconciled = false;
    try {
      const result = await this.client.send(new ConverseCommand(input), {
        abortSignal: AbortSignal.timeout(this.config.timeout),
      });
      const inputTokens = result.usage?.inputTokens;
      const outputTokens = result.usage?.outputTokens;
      if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens))
        throw Object.assign(new Error("Missing usage"), { code: "usage_missing" });
      const estimatedCostMicros = await this.accounting.settle(
        reservation,
        Number(inputTokens),
        Number(outputTokens),
      );
      reconciled = true;
      this.log({
        event: "ai_usage", assistantId: reservation.assistantId,
        provider: "bedrock", model: this.config.model,
        inputTokens: inputTokens ?? null, outputTokens: outputTokens ?? null,
        reservedTokens: reservation.reservedTokens,
        estimatedCostMicros,
      });
      if (result.stopReason !== "end_turn")
        throw Object.assign(new Error("Incomplete or refused output"), {
          code: result.stopReason === "content_filtered" || result.stopReason === "guardrail_intervened"
            ? "output_refusal" : "output_incomplete",
        });
      const text = result.output?.message?.content?.map((block) => "text" in block ? block.text : "").join("") || "";
      return validateAndMapPublicResult(parsePublicModelResult(text), request.approved);
    } catch (error) {
      const { status, reason } = safeFailure(error);
      if (!reconciled) await this.accounting.fail(reservation, reason);
      this.log({ event: "ai_failure", assistantId: reservation.assistantId,
        provider: "bedrock", model: this.config.model,
        reservedTokens: reservation.reservedTokens, status, reason });
      throw new AIControlError(503, "AI_UNAVAILABLE");
    }
  }
}

export function configuredBedrockProvider() {
  const production = process.env.NODE_ENV === "production" || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  if (process.env.AI_PROVIDER !== "bedrock") return undefined;
  if (production && process.env.MEDY_PRODUCTION_AI !== "true")
    throw new Error("Production AI configuration error: Bedrock requires MEDY_PRODUCTION_AI=true.");
  if (!production && process.env.MEDY_LOCAL_AI !== "true") return undefined;
  const config = bedrockConfig();
  return new BedrockPublicProvider(
    new BedrockRuntimeClient({
      region: config.region,
      maxAttempts: 2,
      retryMode: "adaptive",
    }),
    config,
    configuredPaidInferenceAccounting(),
  );
}
