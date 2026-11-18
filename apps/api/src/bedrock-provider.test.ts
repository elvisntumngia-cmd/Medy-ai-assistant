import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { BedrockPublicProvider, configuredBedrockProvider } from "./bedrock-provider.js";
import { AIControlError } from "./public-ai-shared.js";
import { safeFailure } from "./public-ai-shared.js";
import { createApp } from "./app.js";
import request from "supertest";
import type {
  InferenceReservation,
  PaidInferenceAccounting,
} from "./inference-accounting.js";

const config = {
  model: "amazon.nova-micro-v1:0" as const, region: "us-east-1", maxInput: 2000,
  history: 10, maxOutput: 450, timeout: 1000, temperature: 0.2,
};
const chat = [{ role: "user", content: "What is Securemedy?" }];
const output = (text: string, stopReason: ConverseCommandOutput["stopReason"] = "end_turn") => ({
  stopReason, output: { message: { role: "assistant", content: [{ text }] } },
  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  metrics: { latencyMs: 1 }, $metadata: {},
}) as ConverseCommandOutput;
const reservation: InferenceReservation = {
  id: "test", monthKey: "MONTH#2026-11", dayKey: "DAY#2026-11-18#public",
  assistantId: "public", reservedTokens: 500, reservedCostMicros: 50,
};
const accounting = (): PaidInferenceAccounting => ({
  reserve: vi.fn().mockResolvedValue(reservation),
  settle: vi.fn().mockResolvedValue(2),
  fail: vi.fn().mockResolvedValue(undefined),
});

afterEach(() => vi.unstubAllEnvs());
describe("Bedrock public provider", () => {
  it("uses Converse and maps approved sources", async () => {
    const send = vi.fn().mockResolvedValue(output(JSON.stringify({
      message: "Securemedy provides security services.",
      sourceIds: ["company-overview"], navigationIds: [], offerLeadForm: false,
    })));
    const result = await new BedrockPublicProvider({ send }, config, accounting()).chat("public", chat, []);
    expect(send.mock.calls[0][0].constructor.name).toBe("ConverseCommand");
    expect(result.sources[0].id).toBe("company-overview");
  });
  it.each([
    ["invalid json", "end_turn"],
    [JSON.stringify({ message: "x", sourceIds: [], navigationIds: [], offerLeadForm: false }), "max_tokens"],
    [JSON.stringify({ message: "x", sourceIds: [], navigationIds: [], offerLeadForm: false }), "guardrail_intervened"],
  ] as const)("fails safely for invalid, incomplete, or refused output", async (text, reason) => {
    const log = vi.fn();
    const provider = new BedrockPublicProvider(
      { send: vi.fn().mockResolvedValue(output(text, reason)) },
      config,
      accounting(),
      log,
    );
    await expect(provider.chat("public", chat, [])).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(chat[0].content);
  });
  it("selects Bedrock only with explicit production opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER", "bedrock");
    vi.stubEnv("AWS_REGION", "us-east-1");
    vi.stubEnv("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0");
    expect(() => configuredBedrockProvider()).toThrow(/MEDY_PRODUCTION_AI=true/);
    vi.stubEnv("MEDY_PRODUCTION_AI", "true");
    vi.stubEnv("MEDY_INFERENCE_ACCOUNTING_TABLE", "test-accounting");
    expect(configuredBedrockProvider()).toBeInstanceOf(BedrockPublicProvider);
  });
  it("uses only the safe deterministic public fallback when Bedrock is unavailable", async () => {
    const failing = { chat: vi.fn().mockRejectedValue(new AIControlError(503, "AI_UNAVAILABLE")) };
    const response = await request(createApp({
      publicProvider: failing,
      publicProviderName: "bedrock",
      serveFrontend: false,
    })).post("/api/chat").send({
      mode: "public",
      messages: [{ role: "user", content: "Could you help me understand Securemedy?" }],
    });
    expect(response.status).toBe(200);
    expect(response.body.intent).not.toBe("ai_public");
    expect(failing.chat).toHaveBeenCalledOnce();
  });
  it("classifies AWS SDK failures from metadata without logging messages", () => {
    expect(safeFailure({
      name: "ThrottlingException",
      message: "private visitor content",
      $metadata: { httpStatusCode: 429 },
    })).toEqual({ status: 429, reason: "rate_limit" });
  });
});
