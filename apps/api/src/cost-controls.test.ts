import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  DynamoPaidInferenceAccounting,
  PaidInferenceConfigSchema,
} from "./inference-accounting.js";
import { getPublicKnowledge, verifiedFaqResponse } from "./public-knowledge.js";

const config = (assistantId: "public" | "medyhub" = "public") =>
  PaidInferenceConfigSchema.parse({
    tableName: "accounting",
    assistantId,
    dailyRequests: 2,
    dailyTokens: 1000,
    monthlyAllocationMicros: 4000000,
    monthlyCutoffMicros: 9000000,
    inputUsdPerMillion: 0.035,
    outputUsdPerMillion: 0.14,
  });

describe("paid inference cost controls", () => {
  it("reserves monthly and daily capacity in one atomic transaction", async () => {
    const send = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("limit"), { name: "TransactionCanceledException" }),
    );
    const accounting = new DynamoPaidInferenceAccounting({ send } as never, config());
    await expect(accounting.reserve(100, 50)).rejects.toMatchObject({
      code: "AI_PAID_BUDGET",
    });
    const command = send.mock.calls[0][0];
    expect(command.constructor.name).toBe("TransactWriteCommand");
    expect(command.input.TransactItems).toHaveLength(2);
    expect(command.input.TransactItems[0].Update.ConditionExpression).toContain(
      "estimatedCostMicros",
    );
    expect(command.input.TransactItems[1].Update.ConditionExpression).toContain(
      "reservedTokens",
    );
  });

  it("keeps public and MedyHub attribution separate under one shared cutoff", async () => {
    const publicSend = vi.fn().mockResolvedValue({});
    const hubSend = vi.fn().mockResolvedValue({});
    await new DynamoPaidInferenceAccounting(
      { send: publicSend } as never,
      config("public"),
    ).reserve(100, 50);
    await new DynamoPaidInferenceAccounting(
      { send: hubSend } as never,
      config("medyhub"),
    ).reserve(100, 50);
    const publicUpdate = publicSend.mock.calls[0][0].input.TransactItems[0].Update;
    const hubUpdate = hubSend.mock.calls[0][0].input.TransactItems[0].Update;
    expect(publicUpdate.ExpressionAttributeNames["#assistantCost"]).toBe(
      "publicEstimatedCostMicros",
    );
    expect(hubUpdate.ExpressionAttributeNames["#assistantCost"]).toBe(
      "medyhubEstimatedCostMicros",
    );
    expect(publicUpdate.ExpressionAttributeValues[":totalBefore"]).toBe(
      hubUpdate.ExpressionAttributeValues[":totalBefore"],
    );
  });

  it("retains a failed call reservation and records only metadata", async () => {
    const send = vi.fn().mockResolvedValue({});
    const log = vi.fn();
    const accounting = new DynamoPaidInferenceAccounting(
      { send } as never,
      config(),
      log,
    );
    const reservation = await accounting.reserve(100, 50);
    await accounting.fail(reservation, "timeout");
    const failure = send.mock.calls.at(-1)![0].input.TransactItems;
    expect(JSON.stringify(failure)).not.toContain("estimatedCostMicros :minus");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantId: "public",
        errorCategory: "timeout",
      }),
    );
  });
});

describe("knowledge-first public answers", () => {
  it("bypasses paid inference only for an exact unambiguous approved FAQ", async () => {
    const candidate = getPublicKnowledge()
      .filter((item) => item.reviewStatus !== "dynamic")
      .flatMap((item) => [...item.examples, ...item.aliases])
      .find((query) => verifiedFaqResponse(query));
    expect(candidate).toBeDefined();
    const paid = { chat: vi.fn().mockRejectedValue(new Error("must not run")) };
    const response = await request(
      createApp({
        publicProvider: paid,
        publicProviderName: "bedrock",
        serveFrontend: false,
      }),
    )
      .post("/api/chat")
      .send({ mode: "public", messages: [{ role: "user", content: candidate! }] });
    expect(response.status).toBe(200);
    expect(response.body.intent).toBe("verified_faq");
    expect(response.body.sources[0].id).toBe(
      verifiedFaqResponse(candidate!)!.sources[0].id,
    );
    expect(paid.chat).not.toHaveBeenCalled();
  });

  it("keeps verified FAQ answers available when new paid calls are rejected", async () => {
    const candidate = getPublicKnowledge()
      .flatMap((item) => [...item.examples, ...item.aliases])
      .find((query) => verifiedFaqResponse(query));
    const paid = {
      chat: vi.fn().mockRejectedValue(
        Object.assign(new Error("cutoff"), {
          status: 429,
          code: "AI_PAID_BUDGET",
        }),
      ),
    };
    const app = createApp({
      publicProvider: paid,
      publicProviderName: "bedrock",
      serveFrontend: false,
    });
    const faq = await request(app)
      .post("/api/chat")
      .send({ mode: "public", messages: [{ role: "user", content: candidate! }] });
    expect(faq.status).toBe(200);
    expect(faq.body.intent).toBe("verified_faq");
    expect(paid.chat).not.toHaveBeenCalled();
  });

  it("routes uncertain or non-exact questions to the existing model flow", () => {
    expect(verifiedFaqResponse("Could you interpret all of your capabilities for my unusual site?"))
      .toBeUndefined();
  });
});
