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
  it("uses mock automatically while Bedrock is disabled", async () => {
    const r = await request(app)
      .post("/api/chat")
      .send({
        mode: "public",
        provider: "bedrock",
        messages: [{ role: "user", content: "security services" }],
      });
    expect(r.status).toBe(200);
    expect(r.body.intent).toBe("services");
  });
  it("keeps public knowledge separate", async () =>
    expect(
      (
        await request(app)
          .post("/api/chat")
          .send({
            mode: "public",
            messages: [{ role: "user", content: "payroll uniform employee" }],
          })
      ).body.intent,
    ).toBe("restricted"));
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
        role: "manager",
        messages: [{ role: "user", content: "payroll employee approvals" }],
      });
    expect(r.body.intent).toBe("restricted");
  });
  it("uses knowledge with source metadata", async () => {
    const r = await request(app)
      .post("/api/chat")
      .set(session)
      .send({
        mode: "employee",
        messages: [{ role: "user", content: "operations scheduling policy" }],
      });
    expect(r.body.sources.length).toBeGreaterThan(0);
    expect(r.body.message).toContain("DEMONSTRATION CONTENT");
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
