import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { mutateStore, readStore } from "./knowledge-store.js";

let directory: string;
let file: string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T21:00:00Z"));
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "medy-readiness-"));
  file = path.join(directory, "store.json");
  fs.writeFileSync(file, JSON.stringify(readStore()));
  vi.stubEnv("MEDY_PUBLIC_KNOWLEDGE_FILE", file);
  vi.stubEnv("AI_PROVIDER", "deterministic");
  vi.stubEnv("DEMO_MODE", "false");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("public chatbot production-readiness conversations", () => {
  it.each([
    [
      "company information",
      "What is Securemedy?",
      "company_overview",
      "company-overview",
    ],
    [
      "services",
      "What services do you offer?",
      "services",
      "services-overview",
    ],
    ["industries", "What industries do you serve?", "industries", "industries"],
    [
      "contact details",
      "What is your phone number?",
      "contact_information",
      "company-contact",
    ],
  ])(
    "grounds %s in its approved source",
    async (_name, content, intent, sourceId) => {
      const response = await request(createApp())
        .post("/api/chat")
        .send({ mode: "public", messages: [{ role: "user", content }] });
      expect(response.status).toBe(200);
      expect(response.body.intent).toBe(intent);
      expect(
        response.body.sources.map((source: { id: string }) => source.id),
      ).toContain(sourceId);
      expect(
        response.body.sources.every((source: { url: string }) =>
          source.url.startsWith("https://new.securemedy.com/"),
        ),
      ).toBe(true);
    },
  );

  it("uses the latest follow-up while preserving the conversation payload", async () => {
    const response = await request(createApp())
      .post("/api/chat")
      .send({
        mode: "public",
        conversationId: "readiness-follow-up",
        messages: [
          { role: "user", content: "What services do you offer?" },
          { role: "assistant", content: "We offer several security services." },
          { role: "user", content: "What about hospitals and schools?" },
        ],
      });
    expect(response.status).toBe(200);
    expect(response.body.intent).toBe("industries");
    expect(response.body.sources[0].id).toBe("industry-healthcare");
  });

  it("qualifies fresh listings and attributes each displayed role", async () => {
    const response = await request(createApp())
      .post("/api/chat")
      .send({
        mode: "public",
        messages: [{ role: "user", content: "What jobs are available?" }],
      });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("cannot confirm vacancies");
    expect(
      response.body.sources.filter((source: { id: string }) =>
        source.id.startsWith("official-job-"),
      ),
    ).toHaveLength(3);
    expect(
      response.body.actions.filter((action: { id: string }) =>
        action.id.startsWith("job-official-job-"),
      ),
    ).toHaveLength(3);
  });

  it("does not present outdated listings as current", async () => {
    mutateStore((store) => {
      for (const entry of store.entries.filter((entry) =>
        entry.id.startsWith("official-job-"),
      ))
        entry.retrievedAt = "2026-10-01T00:00:00.000Z";
    }, file);
    const response = await request(createApp())
      .post("/api/chat")
      .send({
        mode: "public",
        messages: [{ role: "user", content: "Are you hiring?" }],
      });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("cannot confirm vacancies");
    expect(
      response.body.sources.some((source: { id: string }) =>
        source.id.startsWith("official-job-"),
      ),
    ).toBe(false);
    expect(
      response.body.actions.some((action: { id: string }) =>
        action.id.startsWith("job-official-job-"),
      ),
    ).toBe(false);
  });

  it("declines unknown facts without citations or invented details", async () => {
    const response = await request(createApp())
      .post("/api/chat")
      .send({
        mode: "public",
        messages: [{ role: "user", content: "What is your annual revenue?" }],
      });
    expect(response.status).toBe(200);
    expect(response.body.intent).toBe("public_clarification");
    expect(response.body.message).toContain(
      "do not have enough verified public information",
    );
    expect(response.body.sources).toEqual([]);
    expect(response.body.message).not.toMatch(/\$|million|billion/i);
  });
});
