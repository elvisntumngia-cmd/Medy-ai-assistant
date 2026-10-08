import { describe, expect, it } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
process.env.DEMO_MODE = "true";
describe("integrated API", () => {
  const app = createApp();
  const session = { "x-demo-session": "demo-officer" };
  it("sets Helmet headers", async () =>
    expect(
      (await request(app).get("/api/health")).headers["x-content-type-options"],
    ).toBe("nosniff"));
  it("serves the built frontend with SPA fallback without intercepting APIs", async () => {
    const demoDist = fs.mkdtempSync(path.join(os.tmpdir(), "medy-demo-dist-"));
    fs.writeFileSync(
      path.join(demoDist, "index.html"),
      '<!doctype html><html><body><div id="root">Medy demo</div></body></html>',
    );
    fs.writeFileSync(path.join(demoDist, "app.js"), "window.__MEDY__ = true;");
    const widgetBundle = path.join(demoDist, "standalone-widget.js");
    fs.writeFileSync(
      widgetBundle,
      'customElements.define("medy-assistant", class extends HTMLElement {});',
    );
    try {
      const productionApp = createApp({
        serveFrontend: true,
        demoDistPath: demoDist,
        widgetBundlePath: widgetBundle,
      });
      const root = await request(productionApp).get("/");
      expect(root.status).toBe(200);
      expect(root.text).toContain("Medy demo");

      const workspace = await request(productionApp).get("/workspace");
      expect(workspace.status).toBe(200);
      expect(workspace.text).toContain("Medy demo");

      const asset = await request(productionApp).get("/app.js");
      expect(asset.status).toBe(200);
      expect(asset.text).toContain("__MEDY__");

      const widget = await request(productionApp).get("/medy-widget.js");
      expect(widget.status).toBe(200);
      expect(widget.headers["content-type"]).toMatch(/javascript/);
      expect(widget.text).toContain('customElements.define("medy-assistant"');
      expect(widget.headers["cache-control"]).toBe("public, max-age=3600");
      expect(widget.headers["cross-origin-resource-policy"]).toBe(
        "cross-origin",
      );

      const health = await request(productionApp).get("/api/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({
        status: "ok",
        provider: "mock",
      });

      const unknownApi = await request(productionApp).get("/api/not-a-route");
      expect(unknownApi.status).toBe(404);
      expect(unknownApi.body.error.code).toBe("NOT_FOUND");
      expect(unknownApi.headers["content-type"]).toMatch(/json/);
    } finally {
      fs.rmSync(demoDist, { recursive: true, force: true });
    }
  });
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
  it("answers each public message independently by conversation ID", async () => {
    const conversationId = "api-warehouse-conversation";
    const send = (content: string) =>
      request(app)
        .post("/api/chat")
        .send({
          mode: "public",
          conversationId,
          messages: [{ role: "user", content }],
        });
    const warehouse = await send("I need security for my warehouse");
    expect(warehouse.body.intent).toBe("physical_security");
    expect(warehouse.body.message).not.toMatch(/how many|what city/i);
    expect(warehouse.body.actions).toContainEqual(
      expect.objectContaining({ type: "start_form" }),
    );
    expect((await send("Are you hiring?")).body.intent).toBe("careers");
    expect((await send("Do you install cameras?")).body.intent).toBe(
      "electronic_security",
    );
  });
  it("routes employee questions away from public knowledge", async () =>
    expect(
      (
        await request(app)
          .post("/api/chat")
          .send({
            mode: "public",
            messages: [{ role: "user", content: "payroll uniform employee" }],
          })
      ).body.intent,
    ).toBe("employee_routing"));
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
    expect(r.body.intent).toBe("employee_routing");
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
  it("allows the local WordPress integration origin", async () =>
    expect(
      (
        await request(app)
          .options("/api/chat")
          .set("Origin", "http://localhost:8888")
          .set("Access-Control-Request-Method", "POST")
      ).headers["access-control-allow-origin"],
    ).toBe("http://localhost:8888"));
  it.each([
    "https://securemedy.ng",
    "https://www.securemedy.ng",
    "https://medy-ai-assistant-demo.onrender.com",
  ])("allows the approved production origin %s", async (origin) =>
    expect(
      (
        await request(app)
          .options("/api/chat")
          .set("Origin", origin)
          .set("Access-Control-Request-Method", "POST")
      ).headers["access-control-allow-origin"],
    ).toBe(origin),
  );
  it("does not grant CORS access to an unapproved origin", async () =>
    expect(
      (
        await request(app)
          .options("/api/chat")
          .set("Origin", "https://untrusted.example")
          .set("Access-Control-Request-Method", "POST")
      ).headers["access-control-allow-origin"],
    ).toBeUndefined());
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
