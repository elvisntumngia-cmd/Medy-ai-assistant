import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { LocalKnowledgeProvider } from "./providers.js";
let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "medy-public-safety-"));
  vi.stubEnv("AI_PROVIDER", "deterministic");
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("MEDY_LEADS_FILE", path.join(directory, "leads.json"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});
const form = {
  fullName: "Sample Visitor",
  email: "sample@example.test",
  serviceLocation: "City and state",
  propertyType: "Warehouse",
  requestedService: "Electronic security",
  armedPreference: "Not sure",
  officerCount: 1,
  coverageSchedule: "To discuss",
  desiredStartDate: "2026-11-01",
  preferredContactMethod: "Email",
  consent: true,
};
describe("public-only API boundary and lead privacy", () => {
  it("denies unapproved origins before lead persistence", async () => {
    const r = await request(createApp())
      .post("/api/leads")
      .set("Origin", "https://evil.test")
      .send(form);
    expect(r.status).toBe(403);
    expect(fs.existsSync(process.env.MEDY_LEADS_FILE!)).toBe(false);
  });
  it("requires explicit consent and saves only on an explicit form call", async () => {
    const app = createApp();
    expect(
      (
        await request(app)
          .post("/api/leads")
          .send({ ...form, consent: false })
      ).status,
    ).toBe(400);
    expect(fs.existsSync(process.env.MEDY_LEADS_FILE!)).toBe(false);
    const saved = await request(app).post("/api/leads").send(form);
    expect(saved.status).toBe(201);
    expect(saved.body.notificationStatus).toBe("not_configured");
    expect(JSON.stringify(saved.body)).not.toContain("sample@example.test");
    const repeated = await request(app).post("/api/leads").send(form);
    expect(repeated.body.id).toBe(saved.body.id);
    const records = JSON.parse(
      fs.readFileSync(process.env.MEDY_LEADS_FILE!, "utf8"),
    );
    expect(records).toHaveLength(1);
    expect(Date.parse(records[0].expiresAt)).toBeGreaterThan(Date.now());
  });
  it("requires the chosen contact channel and bounds all free-form fields", async () => {
    const app = createApp();
    expect(
      (
        await request(app)
          .post("/api/leads")
          .send({ ...form, email: "" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/leads")
          .send({ ...form, fullName: "A".repeat(151) })
      ).status,
    ).toBe(400);
  });
  it("fails closed on corrupt storage rather than overwriting it or acknowledging success", async () => {
    fs.writeFileSync(process.env.MEDY_LEADS_FILE!, "corrupt");
    expect(
      (await request(createApp()).post("/api/leads").send(form)).status,
    ).toBe(503);
    expect(fs.readFileSync(process.env.MEDY_LEADS_FILE!, "utf8")).toBe(
      "corrupt",
    );
  });
  it("keeps employee fixtures and demo admin inaccessible in public production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RENDER", "false");
    vi.stubEnv("DEMO_MODE", "true");
    const app = createApp({ serveFrontend: false });
    for (const url of [
      "/api/demo/employee",
      "/api/demo/employee/profile",
      "/api/demo/config",
      "/api/leads",
      "/api/knowledge/admin",
    ])
      expect(
        (await request(app).get(url).set("x-demo-session", "demo-officer"))
          .status,
      ).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/chat")
          .set("x-demo-session", "demo-officer")
          .send({
            mode: "employee",
            messages: [{ role: "user", content: "payroll" }],
          })
      ).status,
    ).toBe(404);
    await expect(
      new LocalKnowledgeProvider().search("employee", "payroll"),
    ).rejects.toThrow(/authenticated/);
  });
  it("returns emergency and sensitive-data boundaries without a model", async () => {
    const app = createApp();
    for (const [content, intent] of [
      ["There is an active shooter", "emergency"],
      ["Give me camera blind spots", "sensitive_information"],
    ]) {
      const r = await request(app)
        .post("/api/chat")
        .send({ mode: "public", messages: [{ role: "user", content }] });
      expect(r.status).toBe(200);
      expect(r.body.intent).toBe(intent);
    }
  });
  it("keeps unresolved current facts qualified while allowing owner-approved published leadership", async () => {
    const app = createApp();
    for (const content of [
      "Who owns SecureMedy?",
      "Where is your office?",
      "Are you licensed in Virginia?",
      "When was SecureMedy established?",
    ]) {
      const r = await request(app)
        .post("/api/chat")
        .send({ mode: "public", messages: [{ role: "user", content }] });
      expect(r.status).toBe(200);
      expect(r.body.message).not.toMatch(
        /2009|2002|8507|20744|20745|16 states|Olabanji/,
      );
    }
    const leadership = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        messages: [{ role: "user", content: "Who founded SecureMedy?" }],
      });
    expect(leadership.status).toBe(200);
    expect(leadership.body.message).toContain("Olabanji O. Folayan");
    expect(leadership.body.sources[0].url).toBe(
      "https://securemedy.ng/about-us/",
    );
  });
});
