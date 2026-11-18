import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, resolveAllowedOrigins } from "./app.js";

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "deterministic");
  vi.stubEnv("MEDY_PRODUCTION_AI", "false");
  vi.stubEnv("MEDY_LOCAL_AI", "false");
  vi.stubEnv(
    "CLIENT_ORIGIN",
    "https://securemedy.com, https://www.securemedy.com, https://new.securemedy.com",
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("exact-origin CORS", () => {
  it.each([
    "https://securemedy.com",
    "https://www.securemedy.com",
    "https://new.securemedy.com",
  ])(
    "allows chat preflight and API responses for %s",
    async (origin) => {
      const app = createApp();
      const preflight = await request(app)
        .options("/api/chat")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type,x-demo-session");
      expect(preflight.status).toBe(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
      expect(
        preflight.headers["access-control-allow-methods"].split(","),
      ).toContain("POST");
      expect(
        preflight.headers["access-control-allow-headers"]
          .toLowerCase()
          .split(","),
      ).toEqual(["content-type", "x-demo-session"]);
      expect(preflight.headers.vary).toContain("Origin");
      const response = await request(app)
        .post("/api/chat")
        .set("Origin", origin)
        .send({});
      expect(response.status).toBe(400); // Validation reached; no AI request.
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    },
  );

  it("retains every existing default and configured origin", () => {
    expect(resolveAllowedOrigins()).toEqual(
      expect.arrayContaining([
        "https://new.securemedy.com",
        "https://securemedy.com",
        "https://medy-ai-assistant-demo.onrender.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "http://localhost:8888",
        "https://www.securemedy.com",
      ]),
    );
    expect(resolveAllowedOrigins()).not.toContain("*");
  });

  it("allows only configured origins in AWS production", () => {
    vi.stubEnv("MEDY_AWS_PRODUCTION", "true");
    expect(resolveAllowedOrigins()).toEqual([
      "https://securemedy.com",
      "https://www.securemedy.com",
      "https://new.securemedy.com",
    ]);
  });

  it("fails AWS production startup without an explicit origin", () => {
    vi.stubEnv("MEDY_AWS_PRODUCTION", "true");
    vi.stubEnv("CLIENT_ORIGIN", "");
    expect(() => resolveAllowedOrigins()).toThrow(/requires CLIENT_ORIGIN/);
  });

  it.each([
    "https://unapproved.example",
    "https://new.securemedy.com.evil.example",
  ])("does not authorize %s", async (origin) => {
    const app = createApp();
    const preflight = await request(app)
      .options("/api/chat")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
    const response = await request(app)
      .post("/api/chat")
      .set("Origin", origin)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_REJECTED");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
