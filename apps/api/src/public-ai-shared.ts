import { AssistantResponseSchema, extractPublicLinks, type AssistantAction, type AssistantResponse } from "@medy/shared";
import { z } from "zod";
import {
  getPublicKnowledge,
  getPublishedJobs,
  openPublicConflicts,
  retrievePublicKnowledge,
} from "./public-knowledge.js";
import { conflictBoundary, publicBoundary, redactContactDetails } from "./public-policy.js";

export class AIControlError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export const PublicModelResultSchema = z.object({
  message: z.string().min(1).max(2000),
  sourceIds: z.array(z.string()).max(5),
  offerLeadForm: z.boolean().optional().default(false),
  navigationIds: z.array(z.string()).max(8).optional().default([]),
});
export type PublicModelResult = z.infer<typeof PublicModelResultSchema>;
export type PublicKnowledgeEntry = ReturnType<typeof getPublicKnowledge>[number];

export function preparePublicRequest(
  messages: { role: string; content: string }[],
  options: { maxInput: number; history: number; instructions: string },
) {
  if (
    !messages.length || messages.at(-1)?.role !== "user" ||
    messages.some((message) =>
      !["user", "assistant"].includes(message.role) ||
      message.content.length > 2000 ||
      (message.role === "user" && message.content.length > options.maxInput))
  ) throw new AIControlError(400, "AI_INPUT_LIMIT");

  const history = messages.slice(-options.history).map((message) => ({
    role: message.role as "user" | "assistant",
    content: redactContactDetails(message.content),
  }));
  const latest = messages.at(-1)!.content;
  const boundary = publicBoundary(latest) || conflictBoundary(latest);
  if (boundary) return { boundary, history, approved: [], system: "" };

  const latestMatches = retrievePublicKnowledge(latest, 6);
  const previousQuery = history.filter((message) => message.role === "user")
    .slice(0, -1).slice(-2).map((message) => message.content).join(" ");
  const previousMatches = previousQuery ? retrievePublicKnowledge(previousQuery, 3) : [];
  const essentials = getPublicKnowledge().filter((entry) => [
    "company-overview", "services-overview", "company-contact", "careers", "employee-portal",
  ].includes(entry.id));
  const jobs = latestMatches[0]?.topic === "careers" ? getPublishedJobs() : [];
  const serviceDetails = latestMatches.some((entry) => entry.topic === "services")
    ? getPublicKnowledge().filter((entry) => [
        "services-overview", "physical-security", "electronic-security", "risk-management",
      ].includes(entry.id))
    : [];
  const approved = [...new Map([
    ...latestMatches, ...previousMatches, ...essentials, ...serviceDetails, ...jobs,
  ].map((entry) => [entry.id, entry])).values()];
  const system = options.instructions +
    "\nUNRESOLVED_FACTS (not evidence; qualify only the affected fact, do not block unrelated requests): " +
    JSON.stringify(openPublicConflicts().map(({ factKey, details }) => ({ factKey, details }))) +
    "\nAPPROVED_KNOWLEDGE\n" + JSON.stringify(approved.map(
      ({ id, answer, uncertainty, action, retrievedAt }) => ({
        ...(id.startsWith("official-job-") ? { publicationType: "PUBLISHED_JOB_LISTINGS", retrievedAt } : {}),
        id, retrievedAt, answer, uncertainty, navigationLabel: action?.label,
      }),
    ));
  return { boundary: undefined, history, approved, system };
}

export function parsePublicModelResult(raw: string) {
  try {
    return PublicModelResultSchema.parse(JSON.parse(raw));
  } catch {
    throw Object.assign(new Error("Invalid output"), { code: "output_schema" });
  }
}

export function validateAndMapPublicResult(
  parsed: PublicModelResult,
  approved: PublicKnowledgeEntry[],
): AssistantResponse {
  if ([...parsed.sourceIds, ...parsed.navigationIds].some(
    (id) => !approved.some((entry) => entry.id === id),
  )) throw Object.assign(new Error("Unknown source"), { code: "output_unknown_source" });
  const factualClaim = parsed.message.match(/licensed in \d+|established in \d{4}|founded in \d{4}/i)?.[0];
  if (
    /(?:i have|i\x27ve|we have|we\x27ve|i|we) (?:sent|submitted|emailed|dispatched|notified)|your (?:lead|request|message) (?:has been|was|is) (?:sent|submitted|delivered)/i.test(parsed.message) ||
    /\$\s*\d/i.test(parsed.message) ||
    (factualClaim && !approved.some((entry) => parsed.sourceIds.includes(entry.id) &&
      (entry.answer.toLowerCase().includes(factualClaim.toLowerCase()) ||
       (entry.approvalBasis === "official_website" && /founded|establish/i.test(entry.answer) &&
        !!factualClaim.match(/\d{4}/)?.[0] && entry.answer.includes(factualClaim.match(/\d{4}/)![0])))))
  ) throw Object.assign(new Error("Unsupported claim"), { code: "output_unsupported_claim" });

  const sources = approved.filter((entry) => parsed.sourceIds.includes(entry.id));
  const actions: AssistantAction[] = approved
    .filter((entry) => parsed.navigationIds.includes(entry.id) && entry.action)
    .map((entry) => ({
      id: "link-" + entry.id, type: "open_external", label: entry.action!.label,
      target: entry.action!.url, requiresConfirmation: false,
    }));
  const linked = extractPublicLinks(parsed.message);
  actions.push(...linked.actions);
  if (parsed.offerLeadForm) actions.push({
    id: "request-security-services", type: "start_form",
    label: "Request Security Services", requiresConfirmation: false,
  });
  return AssistantResponseSchema.parse({
    message: linked.message, intent: "ai_public", confidence: 0.7, actions,
    sources: sources.map((entry) => ({
      id: entry.id, title: entry.sourceTitle, domain: "public",
      snippet: entry.answer, url: entry.sourceUrl,
    })),
  });
}

export function safeFailure(error: unknown) {
  const failure = error as { status?: unknown; code?: unknown; name?: unknown; cause?: { code?: unknown }; $metadata?: { httpStatusCode?: unknown } } | null;
  const candidate = typeof failure?.status === "number" ? failure.status : failure?.$metadata?.httpStatusCode;
  const status = typeof candidate === "number" && candidate >= 100 && candidate <= 599 ? candidate : undefined;
  const outputReasons = ["output_refusal", "output_incomplete", "output_schema", "output_unknown_source", "output_unsupported_claim"];
  const reason = outputReasons.includes(String(failure?.code)) ? String(failure?.code)
    : failure?.code === "insufficient_quota" ? "quota_or_billing"
    : status === 401 ? "authentication" : status === 403 ? "permission"
    : status === 404 ? "model_or_endpoint" : status === 429 ? "rate_limit"
    : failure?.name === "APIConnectionTimeoutError" || failure?.name === "TimeoutError" || failure?.name === "AbortError" ? "timeout"
    : ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN"].includes(String(failure?.cause?.code)) ? "tls_trust"
    : "upstream_or_output";
  return { status, reason };
}

/** Conservative English/Unicode estimate; accounting is advisory, not a distributed cap. */
export function estimateInputTokens(text: string) {
  let ascii = 0; let unicode = 0;
  for (const character of text) {
    if (character.codePointAt(0)! < 128) ascii++;
    else unicode++;
  }
  return Math.ceil(ascii / 3) + unicode * 4;
}
