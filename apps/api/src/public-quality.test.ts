import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider, OpenAIConfigSchema } from "./openai-provider.js";
import { repositoryRoot } from "./knowledge-store.js";
import { createApp } from "./app.js";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
  },
}));
type Fixture = {
  id: string;
  turns: string[];
  message: string;
  sources: string[];
  knowledge?: string;
  navigation?: string[];
  lead?: boolean;
  boundary?: string;
  failFirst?: boolean;
};
const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(
    path.join(repositoryRoot(), "knowledge/editorial/quality-regression.json"),
    "utf8",
  ),
);
const output = (fixture: Fixture) => ({
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          message: fixture.message,
          sourceIds: fixture.sources,
          navigationIds: fixture.navigation || [],
          offerLeadForm: !!fixture.lead,
        }),
      },
    },
  ],
});
beforeEach(() => mocks.create.mockReset());
afterEach(() => vi.unstubAllEnvs());
describe("public conversation pipeline regression (scripted outputs, not a model-quality evaluation)", () => {
  it.each(fixtures)("$id", async (fixture) => {
    const logs: Record<string, unknown>[] = [];
    const provider = new OpenAIProvider(
      { chat: { completions: { create: mocks.create } } } as never,
      OpenAIConfigSchema.parse({}),
      (event) => logs.push(event),
    );
    mocks.create.mockResolvedValue(output(fixture));
    const history: { role: string; content: string }[] = [];
    for (let i = 0; i < fixture.turns.length; i++) {
      history.push({ role: "user", content: fixture.turns[i] });
      if (fixture.failFirst && i === 0) {
        mocks.create.mockRejectedValueOnce({
          name: "APIConnectionTimeoutError",
        });
        await expect(
          provider.chat("public", history, []),
        ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
        expect(logs.at(-1)?.reason).toBe("timeout");
        continue;
      }
      // Only the final answer is scripted. Earlier turns test context transport without unrelated citations.
      mocks.create.mockResolvedValue(
        output(
          i === fixture.turns.length - 1
            ? fixture
            : {
                ...fixture,
                message: "What else should I know?",
                sources: [],
                navigation: [],
                lead: false,
              },
        ),
      );
      const answer = await provider.chat("public", history, []);
      if (fixture.boundary) {
        expect(answer.intent).toBe(fixture.boundary);
        expect(mocks.create).not.toHaveBeenCalled();
        return;
      }
      expect(answer.intent).toBe("ai_public");
      const sent = mocks.create.mock.calls.at(-1)![0];
      expect(sent.messages.slice(1)).toEqual(history.slice(-10));
      const knowledge = JSON.parse(
        sent.messages[0].content.split("APPROVED_KNOWLEDGE\n")[1],
      );
      expect(
        knowledge.every((item: { answer: string }) => item.answer.length > 60),
      ).toBe(true);
      expect(sent.messages[0].content).toContain("UNRESOLVED_FACTS");
      expect(sent.messages[0].content).not.toContain("PRIVATE EMPLOYEE DATA");
      if (i === fixture.turns.length - 1) {
        if (fixture.knowledge)
          expect(knowledge.map((item: { id: string }) => item.id)).toContain(
            fixture.knowledge,
          );
        expect(answer.message).toBe(fixture.message);
        expect(answer.sources.map((source) => source.id).sort()).toEqual(
          [...fixture.sources].sort(),
        );
        expect(
          answer.actions.some((action) => action.type === "start_form"),
        ).toBe(!!fixture.lead);
        expect(
          answer.actions
            .filter((action) => action.type === "open_external")
            .map((action) => action.id)
            .sort(),
        ).toEqual((fixture.navigation || []).map((id) => "link-" + id).sort());
      }
      history.push({ role: "assistant", content: answer.message });
    }
  });
  it("prioritizes the latest topic over repeated old topics", async () => {
    mocks.create.mockResolvedValue(
      output({
        id: "switch",
        turns: [],
        message: "Use Careers.",
        sources: ["careers"],
      }),
    );
    const provider = new OpenAIProvider(
      { chat: { completions: { create: mocks.create } } } as never,
      OpenAIConfigSchema.parse({}),
      () => {},
    );
    await provider.chat(
      "public",
      [
        {
          role: "user",
          content: "guards cameras warehouse physical electronic security",
        },
        { role: "assistant", content: "What schedule?" },
        { role: "user", content: "I need a job, bro." },
      ],
      [],
    );
    const knowledge = JSON.parse(
      mocks.create.mock.calls[0][0].messages[0].content.split(
        "APPROVED_KNOWLEDGE\n",
      )[1],
    );
    expect(knowledge[0].id).toBe("careers");
  });
  it("passes commercial leadership requests through the API and never writes a lead", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medy-quality-"));
    try {
      vi.stubEnv("MEDY_LEADS_FILE", path.join(dir, "leads.json"));
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("OPENAI_API_KEY", "test-only");
      vi.stubEnv("MEDY_LOCAL_AI", "true");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("RENDER", "false");
      const fixture = fixtures.find(
        (item) => item.id === "executive-contract",
      )!;
      mocks.create.mockResolvedValue(output(fixture));
      const response = await request(createApp())
        .post("/api/chat")
        .send({
          mode: "public",
          messages: [{ role: "user", content: fixture.turns[0] }],
        });
      expect(response.status).toBe(200);
      expect(response.body.intent).toBe("ai_public");
      expect(
        response.body.actions.some(
          (action: { type: string }) => action.type === "start_form",
        ),
      ).toBe(true);
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(process.env.MEDY_LEADS_FILE!)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it.each([
    ["length", "{}", "output_incomplete"],
    ["stop", "not json", "output_schema"],
    [
      "stop",
      JSON.stringify({ message: "Unsupported", sourceIds: ["invented"] }),
      "output_unknown_source",
    ],
  ])(
    "classifies output failures without storing visitor content: %s",
    async (finish_reason, content, reason) => {
      mocks.create.mockResolvedValue({
        choices: [{ finish_reason, message: { content } }],
      });
      const log = vi.fn();
      const provider = new OpenAIProvider(
        { chat: { completions: { create: mocks.create } } } as never,
        OpenAIConfigSchema.parse({}),
        log,
      );
      await expect(
        provider.chat(
          "public",
          [{ role: "user", content: "How about Yoruba?" }],
          [],
        ),
      ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
      expect(log.mock.calls.at(-1)![0].reason).toBe(reason);
      expect(JSON.stringify(log.mock.calls)).not.toContain("Yoruba");
    },
  );
});

it("requests strict schema output with only retrieved citation IDs and distinguishes refusals", async () => {
  mocks.create.mockResolvedValue({
    choices: [
      {
        finish_reason: "stop",
        message: { refusal: "not logged", content: null },
      },
    ],
  });
  const log = vi.fn();
  const provider = new OpenAIProvider(
    { chat: { completions: { create: mocks.create } } } as never,
    OpenAIConfigSchema.parse({}),
    log,
  );
  await expect(
    provider.chat(
      "public",
      [{ role: "user", content: "How about Yoruba?" }],
      [],
    ),
  ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  const format = mocks.create.mock.calls[0][0].response_format;
  expect(format.type).toBe("json_schema");
  expect(format.json_schema.strict).toBe(true);
  expect(
    format.json_schema.schema.properties.sourceIds.items.enum,
  ).not.toContain("unapproved");
  expect(log.mock.calls.at(-1)![0].reason).toBe("output_refusal");
  expect(JSON.stringify(log.mock.calls)).not.toContain("not logged");
});
