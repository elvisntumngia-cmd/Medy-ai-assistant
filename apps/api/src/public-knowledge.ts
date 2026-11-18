export {
  PUBLIC_LINKS,
  PublicKnowledgeItemSchema,
  type PublicKnowledgeItem,
} from "./public-knowledge-schema.js";
import { PublicKnowledgeRepository, readStore } from "./knowledge-store.js";
import { AssistantResponseSchema } from "@medy/shared";
export function getPublicKnowledge() {
  return new PublicKnowledgeRepository().approved();
}
export function retrievePublicKnowledge(query: string, limit = 5) {
  return new PublicKnowledgeRepository().search({
    namespace: "public",
    query,
    limit,
  });
}

const normalizeFaq = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Exact, unique, uncertainty-free approved FAQ matches may bypass paid inference. */
export function verifiedFaqResponse(query: string) {
  const normalized = normalizeFaq(query);
  if (!normalized) return undefined;
  const matches = getPublicKnowledge().filter(
    (entry) =>
      entry.reviewStatus !== "dynamic" &&
      [...entry.examples, ...entry.aliases].some(
        (candidate) => normalizeFaq(candidate) === normalized,
      ),
  );
  if (matches.length !== 1) return undefined;
  const entry = matches[0];
  return AssistantResponseSchema.parse({
    message: [entry.answer, entry.uncertainty].filter(Boolean).join(" "),
    intent: "verified_faq",
    confidence: 1,
    actions: entry.action
      ? [{
          id: `faq-${entry.id}`,
          type: "open_external",
          label: entry.action.label,
          target: entry.action.url,
          requiresConfirmation: false,
        }]
      : [],
    sources: [{
      id: entry.id,
      title: entry.sourceTitle,
      domain: "public",
      snippet: entry.answer,
      url: entry.sourceUrl,
    }],
  });
}
// Compatibility exports; runtime callers use the dynamic accessors, so withdrawals need no rebuild.
export const publicKnowledge = getPublicKnowledge();
export const publicKnowledgeById = {
  get: (id: string) => getPublicKnowledge().find((e) => e.id === id),
};
export function openPublicConflicts() {
  return readStore()
    .conflicts.filter((c) => c.state === "open")
    .map((conflict) =>
      conflict.factKey === "founder" &&
      getPublicKnowledge().some(
        (entry) =>
          entry.id === "leadership" &&
          entry.approvalBasis === "official_website",
      )
        ? {
            ...conflict,
            details:
              "Official website establishment attribution and published Chairman title are approved. Report the published wording; do not infer current legal ownership.",
          }
        : conflict,
    );
}

/** Only freshly refreshed public listings; these do not prove current hiring status. */
export function getPublishedJobs() {
  const now = Date.now();
  return getPublicKnowledge().filter(
    (entry) =>
      entry.id.startsWith("official-job-") &&
      new URL(entry.sourceUrl).hostname === "new.securemedy.com" &&
      Date.parse(entry.retrievedAt) <= now &&
      Date.parse(entry.retrievedAt) > now - 86400000,
  );
}
