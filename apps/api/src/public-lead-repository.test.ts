import { describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoPublicLeadRepository } from "./public-lead-repository.js";

const lead = {
  fullName: "Sample Visitor", organization: "", email: "sample@example.test", phone: "",
  serviceLocation: "Maryland", propertyType: "Warehouse", requestedService: "Guarding",
  armedPreference: "Not sure" as const, officerCount: 1, coverageSchedule: "Nights",
  desiredStartDate: "2026-12-01", preferredContactMethod: "Email" as const, consent: true as const,
  additionalDetails: "",
};

describe("Dynamo public lead repository", () => {
  it("writes a durable TTL record without listing support", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoPublicLeadRepository({ send } as unknown as DynamoDBDocumentClient, "leads", 30);
    const record = await repository.create(lead);
    expect(record.id).toMatch(/^MEDY-/);
    const item = send.mock.calls[0][0].input.Item;
    expect(item.pk).toMatch(/^DUP#/);
    expect(item.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect("list" in repository).toBe(false);
  });
  it("returns the existing record after an atomic duplicate conflict", async () => {
    const existing = { ...lead, id: "MEDY-existing", status: "New", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString() };
    const send = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { name: "ConditionalCheckFailedException" }))
      .mockResolvedValueOnce({ Item: existing });
    const repository = new DynamoPublicLeadRepository({ send } as unknown as DynamoDBDocumentClient, "leads", 30);
    expect((await repository.create(lead)).id).toBe("MEDY-existing");
    expect(send.mock.calls[1][0].input.ConsistentRead).toBe(true);
  });
});
