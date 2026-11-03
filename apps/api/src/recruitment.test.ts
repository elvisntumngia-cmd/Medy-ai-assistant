import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { readStore, mutateStore } from "./knowledge-store.js";
import { getPublishedJobs } from "./public-knowledge.js";
import { PublicAssistantProvider } from "./public-assistant.js";
import { OpenAIProvider, OpenAIConfigSchema } from "./openai-provider.js";
let directory: string;
beforeEach(() => {
  // Match the latest verified fixture date; production expiry remains unchanged.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T21:00:00Z"));
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "medy-jobs-"));
  const file = path.join(directory, "store.json");
  fs.writeFileSync(file, JSON.stringify(readStore()));
  vi.stubEnv("MEDY_PUBLIC_KNOWLEDGE_FILE", file);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});
describe("fresh published recruitment guidance", () => {
  it("makes eight substantive published role headings available with verified detail URLs", () => {
    const jobs = getPublishedJobs();
    expect(jobs).toHaveLength(8);
    expect(jobs.some((job) => job.answer.includes("Washington"))).toBe(true);
    for (const job of jobs) {
      expect(job.action?.url).toContain(
        "https://new.securemedy.com/careers/jobs/",
      );
      expect(job.uncertainty).toContain("not a confirmed current vacancy");
    }
  });
  it("lists published roles with individual buttons and a current-status qualification", async () => {
    const answer = await new PublicAssistantProvider().chat(
      "public",
      [{ role: "user", content: "Are you hiring?" }],
      [],
    );
    expect(answer.message).toContain("Our website lists");
    expect(answer.message).toContain("cannot confirm vacancies");
    expect(
      answer.sources.filter((source) => source.id.startsWith("official-job-")),
    ).toHaveLength(3);
    expect(
      answer.actions.filter((action) =>
        action.target?.includes("/careers/jobs/"),
      ),
    ).toHaveLength(3);
  });
  it("rejects future-dated role snapshots as well as stale ones", () => {
    mutateStore((store) => {
      for (const entry of store.entries.filter((entry) =>
        entry.id.startsWith("official-job-"),
      ))
        entry.retrievedAt = new Date(Date.now() + 60000).toISOString();
    });
    expect(getPublishedJobs()).toHaveLength(0);
  });
  it("uses the Careers fallback when role snapshots are stale", async () => {
    mutateStore((store) => {
      for (const entry of store.entries.filter((entry) =>
        entry.id.startsWith("official-job-"),
      ))
        entry.retrievedAt = new Date(Date.now() - 2 * 86400000).toISOString();
    });
    expect(getPublishedJobs()).toHaveLength(0);
    const answer = await new PublicAssistantProvider().chat(
      "public",
      [{ role: "user", content: "Are you hiring?" }],
      [],
    );
    expect(
      answer.actions.some(
        (action) => action.target === "https://new.securemedy.com/careers/",
      ),
    ).toBe(true);
    expect(answer.message).toContain("cannot confirm vacancies");
    expect(
      answer.actions.some((action) =>
        action.target?.includes("/careers/jobs/"),
      ),
    ).toBe(false);
  });
  it("sends job headings, dates, first-person voice and no-live-feed limits to OpenAI without paid calls", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              message:
                "Our website lists roles, but we cannot confirm they are still open.",
              sourceIds: ["careers"],
              navigationIds: ["careers"],
              offerLeadForm: false,
            }),
          },
        },
      ],
    });
    await new OpenAIProvider(
      { chat: { completions: { create } } } as never,
      OpenAIConfigSchema.parse({}),
      () => {},
    ).chat(
      "public",
      [{ role: "user", content: "What jobs are currently available?" }],
      [],
    );
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("PUBLISHED_JOB_LISTINGS");
    expect(prompt).toContain("Campus Safety Officer");
    expect(prompt).toContain("retrievedAt");
    expect(prompt).toContain("using we, our team and contact us");
    expect(prompt).toContain("not verified live openings");
  });
});
