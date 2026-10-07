import { describe, expect, it } from "vitest";
import {
  canSearchInternalKnowledge,
  internalKnowledgeDomains,
  internalSourceRegistry,
} from "./knowledge-security.js";

describe("future private internal knowledge boundary", () => {
  it("registers every authorized internal domain without source content", () => {
    expect(internalKnowledgeDomains).toHaveLength(6);
    expect(internalSourceRegistry.map((item) => item.domain)).toEqual(
      internalKnowledgeDomains,
    );
  });

  it("requires authentication and an explicit knowledge scope", () => {
    expect(
      canSearchInternalKnowledge(
        {
          authenticated: false,
          permissions: [],
          knowledgeScopes: ["internal.*"],
        },
        "internal.finance",
      ),
    ).toBe(false);
    expect(
      canSearchInternalKnowledge(
        { authenticated: true, permissions: [], knowledgeScopes: [] },
        "internal.finance",
      ),
    ).toBe(false);
    expect(
      canSearchInternalKnowledge(
        {
          authenticated: true,
          permissions: ["employee"],
          knowledgeScopes: ["internal.finance"],
        },
        "internal.finance",
      ),
    ).toBe(true);
  });
});
