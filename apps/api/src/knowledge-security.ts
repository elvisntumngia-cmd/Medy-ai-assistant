export const internalKnowledgeDomains = [
  "internal.m3dyhub",
  "internal.support_services",
  "internal.operations",
  "internal.finance",
  "internal.client_relations",
  "internal.programs_management",
] as const;

export type InternalKnowledgeDomain = (typeof internalKnowledgeDomains)[number];

export type KnowledgeAuthorizationContext = {
  authenticated: boolean;
  department?: string;
  role?: string;
  permissions: string[];
  knowledgeScopes: string[];
};

export const internalSourceRegistry = [
  { domain: "internal.m3dyhub", status: "requires_confirmation" },
  { domain: "internal.support_services", status: "requires_confirmation" },
  { domain: "internal.operations", status: "draft" },
  { domain: "internal.finance", status: "requires_confirmation" },
  { domain: "internal.client_relations", status: "provisional" },
  { domain: "internal.programs_management", status: "requires_confirmation" },
] as const;

export const canSearchInternalKnowledge = (
  context: KnowledgeAuthorizationContext,
  domain: InternalKnowledgeDomain,
) =>
  context.authenticated &&
  (context.knowledgeScopes.includes("internal.*") ||
    context.knowledgeScopes.includes(domain));

// Confidential source content is intentionally excluded from this public
// repository. A future private adapter must authorize scopes before retrieval.
