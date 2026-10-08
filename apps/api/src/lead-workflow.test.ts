import { describe, expect, it } from "vitest";
import {
  LeadWorkflow,
  MemoryLeadRepository,
  MockLeadNotificationProvider,
  type LeadNotificationProvider,
} from "./lead-workflow.js";

const lead = {
  visitorName: "Alex Morgan",
  email: "alex@example.test",
  preferredContactMethod: "email" as const,
  serviceCategory: "Physical security",
  facilityType: "warehouse",
  requirementsSummary: "Two overnight guards for a warehouse.",
  consent: true as const,
};

describe("lead workflow", () => {
  it("persists before mock notification and suppresses duplicates", async () => {
    const repository = new MemoryLeadRepository();
    const workflow = new LeadWorkflow(
      repository,
      new MockLeadNotificationProvider(),
    );
    const first = await workflow.submit(lead);
    expect(first.record.notificationStatus).toBe("simulated");
    expect(repository.records).toHaveLength(1);
    const duplicate = await workflow.submit(lead);
    expect(duplicate.duplicate).toBe(true);
    expect(repository.records).toHaveLength(1);
  });

  it("does not lose a persisted lead when notification fails", async () => {
    const repository = new MemoryLeadRepository();
    const failing: LeadNotificationProvider = {
      async notify() {
        throw new Error("temporary provider failure");
      },
    };
    const result = await new LeadWorkflow(repository, failing).submit(lead);
    expect(repository.records).toHaveLength(1);
    expect(result.record.notificationStatus).toBe("failed");
  });

  it("rejects missing contact details and missing consent", async () => {
    const workflow = new LeadWorkflow(
      new MemoryLeadRepository(),
      new MockLeadNotificationProvider(),
    );
    await expect(
      workflow.submit({ ...lead, email: undefined }),
    ).rejects.toThrow();
    await expect(
      workflow.submit({ ...lead, consent: false as true }),
    ).rejects.toThrow();
  });
});
