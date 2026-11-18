import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readStore } from "./knowledge-store.js";

const template = fs.readFileSync(path.resolve(process.cwd(), "template.yaml"), "utf8");

describe("AWS production infrastructure contract", () => {
  it("uses an explicit HTTP API payload contract and distributed controls", () => {
    expect(template).toContain('PayloadFormatVersion: "2.0"');
    expect(template).toContain("ReservedConcurrentExecutions: !Ref ReservedConcurrency");
    expect(template).toContain("ThrottlingBurstLimit: 5");
    expect(template).toContain("ThrottlingRateLimit: 2");
    expect(template).toContain("RetentionInDays: !Ref LogRetentionDays");
    expect(template).toContain("Default: 14");
    expect(template).not.toContain("Tracing: Active");
  });

  it("configures both exact website origins without wildcard CORS", () => {
    expect(template).toContain(
      "Default: https://securemedy.com,https://www.securemedy.com,https://new.securemedy.com",
    );
    expect(template).toMatch(
      /AllowOrigins:\s*\n\s*- https:\/\/securemedy\.com\s*\n\s*- https:\/\/new\.securemedy\.com\s*\n\s*- https:\/\/www\.securemedy\.com/,
    );
    expect(template).toContain("AllowHeaders: [content-type, x-request-id]");
    expect(template).toContain("AllowMethods: [GET, POST, OPTIONS]");
    expect(template).toContain("MaxAge: 600");
    expect(template).toContain("CLIENT_ORIGIN: !Ref AllowedOrigins");
    expect(template).not.toContain('AllowOrigins: !Split [",", !Ref AllowedOrigins]');
    expect(template).not.toMatch(/AllowOrigins:\s*\[?\s*["']?\*/);
  });

  it("keeps runtime permissions scoped to the selected model and lead table", () => {
    expect(template).toContain("bedrock:InvokeModel");
    expect(template).toContain("foundation-model/${BedrockModelId}");
    expect(template).toContain("Action: [dynamodb:PutItem, dynamodb:GetItem]");
    expect(template).toContain("Resource: !GetAtt LeadsTable.Arn");
    expect(template).not.toContain("bedrock:*");
    expect(template).not.toContain("dynamodb:*");
  });

  it("uses the low-cost launch defaults and both actual and forecast budget alerts", () => {
    expect(template).toContain("MonthlyBudgetUsd:\n    Type: Number\n    Default: 5");
    expect(template).toContain("ReservedConcurrency:\n    Type: Number\n    Default: 3");
    expect(template).toContain("NotificationType: ACTUAL");
    expect(template).toContain("NotificationType: FORECASTED");
    expect(template).toContain("program.specialist@securemedy.com");
    expect(template).toContain("uniform.equipment@securemedy.com");
    expect(template.match(/SubscriptionType: EMAIL/g)).toHaveLength(4);
    expect(template).toContain("CostFilters:\n          Service:");
    expect(template).toContain("- Amazon Bedrock");
    expect(template).toContain("- AWS Lambda");
  });

  it("bundles the approved knowledge fallback and does not mask a missing configured file", () => {
    const bundled = readStore("");
    expect(bundled.entries.some((entry) => entry.id === "company-overview")).toBe(true);
    expect(() => readStore(path.resolve("missing-explicit-store.json"))).toThrow();
  });
});
