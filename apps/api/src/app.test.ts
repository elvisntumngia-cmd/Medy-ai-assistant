import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
process.env.DEMO_MODE = "true";
describe("integrated API", () => {
  const app = createApp();
  const session = { "x-demo-session": "demo-officer" };
  it("sets Helmet headers", async () =>
    expect(
      (await request(app).get("/api/health")).headers["x-content-type-options"],
    ).toBe("nosniff"));
  it("uses the deterministic local engine", async () => {
    const r = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        provider: "mock",
        messages: [{ role: "user", content: "security services" }],
      });
    expect(r.status).toBe(200);
    expect(r.body.intent).toBe("services");
  });
  it("keeps public and employee knowledge strictly separated", async () => {
    const result = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        conversationId: "separation-test",
        messages: [{ role: "user", content: "payroll uniform employee" }],
      });
    expect(result.body.intent).toBe("low_confidence_clarification");
    expect(
      result.body.sources.every(
        (source: { domain: string }) => source.domain === "public",
      ),
    ).toBe(true);
    expect(JSON.stringify(result.body)).not.toContain(
      "M3dyHub employee demo knowledge",
    );
  });
  it("rejects employee chat without a session", async () =>
    expect(
      (
        await request(app)
          .post("/api/chat")
          .send({
            mode: "employee",
            messages: [{ role: "user", content: "my requests" }],
          })
      ).status,
    ).toBe(401));
  it("rejects employee endpoints without or with an unknown session", async () => {
    expect((await request(app).get("/api/demo/employee")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/demo/employee")
          .set("x-demo-session", "unknown")
      ).status,
    ).toBe(401);
  });
  it("accepts explicitly provisioned officer and manager sessions", async () => {
    expect(
      (
        await request(app)
          .get("/api/demo/employee")
          .set("x-demo-session", "demo-officer")
      ).body.roleKey,
    ).toBe("officer");
    expect(
      (
        await request(app)
          .get("/api/demo/employee")
          .set("x-demo-session", "demo-manager")
      ).body.roleKey,
    ).toBe("manager");
  });
  it("does not accept an employee role through public chat JSON", async () => {
    const r = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        conversationId: "role-injection-test",
        role: "manager",
        messages: [{ role: "user", content: "payroll employee approvals" }],
      });
    expect(r.body.intent).toBe("low_confidence_clarification");
  });
  it("uses knowledge with source metadata", async () => {
    const r = await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        conversationId: "policy-source-test",
        messages: [{ role: "user", content: "show me the policy handbook" }],
      });
    expect(r.body.sources.length).toBeGreaterThan(0);
    expect(r.body.message).toContain("PROVISIONAL DEMONSTRATION GUIDANCE");
    expect(r.body.sources[0].status).toBe("provisional");
  });
  it("collects payroll fields one focused question at a time", async () => {
    const first = await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        conversationId: "payroll-flow",
        messages: [{ role: "user", content: "My payroll has missing hours" }],
      });
    expect(first.body.intent).toBe("payroll_issue");
    expect(first.body.missingRequiredFields).toEqual(["affected pay period"]);
    const second = await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        conversationId: "payroll-flow",
        messages: [{ role: "user", content: "yesterday" }],
      });
    expect(second.body.missingRequiredFields).toEqual([]);
    expect(second.body.message).toContain("details needed");
  });
  it("returns fixed emergency guidance before a workflow", async () => {
    const r = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        conversationId: "emergency-test",
        messages: [
          {
            role: "user",
            content: "There is an active threat and someone has a gun",
          },
        ],
      });
    expect(r.body.intent).toBe("emergency");
    expect(r.body.confidence).toBe(1);
    expect(r.body.message).toContain("call 911");
    expect(r.body.missingRequiredFields).toEqual([]);
  });
  it("logs unsupported questions and safely clarifies", async () => {
    const r = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        conversationId: "fallback-test",
        messages: [
          {
            role: "user",
            content: "Can you diagnose the noise in my refrigerator?",
          },
        ],
      });
    expect(r.body.intent).toBe("low_confidence_clarification");
    expect(r.body.message).toContain("not confident enough");
  });
  it("resets contextual conversation state", async () => {
    await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        conversationId: "reset-test",
        messages: [{ role: "user", content: "My uniform is damaged" }],
      });
    const reset = await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        conversationId: "reset-test",
        messages: [{ role: "user", content: "reset conversation" }],
      });
    expect(reset.body.intent).toBe("conversation_reset");
  });
  it("switches trusted session identity", async () => {
    await request(app).post("/api/demo/config").set(session).send({
      role: "manager",
      provider: "mock",
      delay: false,
      providerError: false,
    });
    const r = await request(app).get("/api/demo/employee").set(session);
    expect(r.body.roleKey).toBe("manager");
    expect(r.body.permissions).toContain("review_approvals");
  });
  it("exposes employee data endpoints", async () => {
    for (const p of [
      "profile",
      "leave",
      "requests",
      "training",
      "approvals",
      "uniform",
      "equipment",
      "license",
      "recent",
    ])
      expect(
        (await request(app).get(`/api/demo/employee/${p}`).set(session)).status,
      ).toBe(200);
  });
  it("rejects disallowed actions with 403", async () =>
    expect(
      (
        await request(app)
          .post("/api/demo/actions")
          .set(session)
          .send({
            action: {
              id: "bad",
              type: "navigate",
              label: "Bad",
              requiresConfirmation: false,
            },
            confirmed: true,
          })
      ).status,
    ).toBe(403));
  it("requires confirmation with 409", async () =>
    expect(
      (
        await request(app)
          .post("/api/demo/actions")
          .set(session)
          .send({
            action: {
              id: "payroll",
              type: "submit_mock_request",
              label: "Payroll",
              requiresConfirmation: true,
            },
            confirmed: false,
          })
      ).status,
    ).toBe(409));
  it("records actor and correlation ID", async () => {
    const r = await request(app)
      .post("/api/demo/actions")
      .set(session)
      .send({
        action: {
          id: "payroll",
          type: "submit_mock_request",
          label: "Payroll",
          requiresConfirmation: true,
        },
        confirmed: true,
      });
    expect(r.status).toBe(201);
    expect(r.body.actor).toBeTruthy();
    expect(r.body.correlationId).toBeTruthy();
  });
  it("resets persisted data", async () => {
    await request(app)
      .post("/api/demo/reset")
      .set(session)
      .send({ leads: true, actions: true, session: true });
    expect((await request(app).get("/api/leads")).body).toEqual([]);
    expect((await request(app).get("/api/demo/actions")).body).toEqual([]);
  });
  it("uses configured CORS origin", async () =>
    expect(
      (
        await request(app)
          .options("/api/chat")
          .set("Origin", "http://localhost:5180")
          .set("Access-Control-Request-Method", "POST")
      ).headers["access-control-allow-origin"],
    ).toBe("http://localhost:5180"));
  it("hides administration routes outside demo mode", async () => {
    process.env.DEMO_MODE = "false";
    const productionLikeApp = createApp();
    expect((await request(productionLikeApp).get("/api/leads")).status).toBe(
      404,
    );
    expect(
      (await request(productionLikeApp).get("/api/demo/config").set(session))
        .status,
    ).toBe(404);
    expect(
      (await request(productionLikeApp).post("/api/demo/reset").send({}))
        .status,
    ).toBe(404);
    process.env.DEMO_MODE = "true";
  });
});
