import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { BedrockPublicProvider, configuredBedrockProvider } from "./bedrock-provider.js";
import { AIControlError } from "./public-ai-shared.js";
import { safeFailure } from "./public-ai-shared.js";
import { createApp } from "./app.js";
import request from "supertest";

const config = {
  model: "amazon.nova-micro-v1:0", region: "us-east-1", maxInput: 2000,
  history: 10, maxOutput: 450, timeout: 1000, temperature: 0.2,
  dailyTokens: 250000,
};
const chat = [{ role: "user", content: "What is Securemedy?" }];
const output = (text: string, stopReason: ConverseCommandOutput["stopReason"] = "end_turn") => ({
  stopReason, output: { message: { role: "assistant", content: [{ text }] } },
  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  metrics: { latencyMs: 1 }, $metadata: {},
}) as ConverseCommandOutput;

afterEach(() => vi.unstubAllEnvs());
describe("Bedrock public provider", () => {
  it("uses Converse and maps approved sources", async () => {
    const send = vi.fn().mockResolvedValue(output(JSON.stringify({
      message: "Securemedy provides security services.",
      sourceIds: ["company-overview"], navigationIds: [], offerLeadForm: false,
    })));
    const result = await new BedrockPublicProvider({ send }, config).chat("public", chat, []);
    expect(send.mock.calls[0][0].constructor.name).toBe("ConverseCommand");
    expect(result.sources[0].id).toBe("company-overview");
  });
  it.each([
    ["invalid json", "end_turn"],
    [JSON.stringify({ message: "x", sourceIds: [], navigationIds: [], offerLeadForm: false }), "max_tokens"],
    [JSON.stringify({ message: "x", sourceIds: [], navigationIds: [], offerLeadForm: false }), "guardrail_intervened"],
  ] as const)("fails safely for invalid, incomplete, or refused output", async (text, reason) => {
    const log = vi.fn();
    const provider = new BedrockPublicProvider({ send: vi.fn().mockResolvedValue(output(text, reason)) }, config, log);
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
    expect(configuredBedrockProvider()).toBeInstanceOf(BedrockPublicProvider);
  });
  it("uses only the safe deterministic public fallback when Bedrock is unavailable", async () => {
    const failing = { chat: vi.fn().mockRejectedValue(new AIControlError(503, "AI_UNAVAILABLE")) };
    const response = await request(createApp({
      publicProvider: failing,
      publicProviderName: "bedrock",
      serveFrontend: false,
    })).post("/api/chat").send({ mode: "public", messages: chat });
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
