export {
  PUBLIC_LINKS,
  PublicKnowledgeItemSchema,
  type PublicKnowledgeItem,
} from "./public-knowledge-schema.js";
import { PublicKnowledgeRepository, readStore } from "./knowledge-store.js";
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
