import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PublicKnowledgeItemSchema } from "./public-knowledge-schema.js";

export const hashText = (text: string) =>
  crypto.createHash("sha256").update(text).digest("hex");
const state = z.enum(["approved", "rejected", "needs-review", "withdrawn"]);
const version = z.object({
  at: z.string().datetime(),
  actor: z.string().min(1),
  reason: z.string().min(1),
  hash: z.string(),
  state,
  answer: z.string(),
});
export const EntrySchema = PublicKnowledgeItemSchema.extend({
  approvalBasis: z.enum(["editorial", "official_website"]).default("editorial"),
  officialSourceHash: z.string().optional(),
  lastVerifiedAt: z.string().date().nullable(),
  state,
  factKeys: z.array(z.string()).default([]),
  retrievedAt: z.string().datetime(),
  contentHash: z.string(),
  expiresAt: z.string().datetime(),
  refreshDays: z.number().int().positive().max(365),
  versions: z.array(version).min(1),
});
export const SourceRecordSchema = z.object({
  visibility: z.literal("public").default("public"),
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  category: z.string(),
  retrievedAt: z.string().datetime(),
  contentHash: z.string(),
  text: z.string().max(24000),
  state: state.default("needs-review"),
  verifiedAt: z.string().date().nullable(),
  refreshDays: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  status: z.number().int(),
  versions: z.array(
    z.object({ at: z.string(), hash: z.string(), text: z.string().max(24000) }),
  ),
});
export const StoreSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  entries: z.array(EntrySchema),
  sources: z.array(SourceRecordSchema),
  conflicts: z.array(
    z.object({
      id: z.string(),
      factKey: z.string(),
      state: z.enum(["open", "resolved"]),
      details: z.string(),
      evidence: z.array(z.string()),
      resolution: z.string().optional(),
      resolvedBy: z.string().optional(),
    }),
  ),
  links: z.array(
    z.object({
      url: z.string().url(),
      checkedAt: z.string().datetime(),
      status: z.number().int(),
      finalUrl: z.string().url(),
    }),
  ),
});
export type EditorialStore = z.infer<typeof StoreSchema>;
export type EditorialEntry = z.infer<typeof EntrySchema>;
export function repositoryRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 7; i++, dir = path.dirname(dir))
    if (fs.existsSync(path.join(dir, "knowledge", "editorial"))) return dir;
  throw new Error("Editorial knowledge directory missing");
}
export const defaultStorePath = () =>
  process.env.MEDY_PUBLIC_KNOWLEDGE_FILE ||
  path.join(repositoryRoot(), "knowledge/editorial/store.json");
export function readStore(file = defaultStorePath()): EditorialStore {
  if (fs.statSync(file).size > 8_000_000)
    throw new Error("Knowledge store exceeds size limit");
  return StoreSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}
export function mutateStore(
  update: (store: EditorialStore) => void,
  file = defaultStorePath(),
) {
  const lock = file + ".lock";
  const descriptor = fs.openSync(lock, "wx");
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    const data = readStore(file);
    update(data);
    data.revision++;
    const serialized = JSON.stringify(StoreSchema.parse(data), null, 2) + "\n";
    if (Buffer.byteLength(serialized) > 8_000_000)
      throw new Error("Archive research before exceeding the knowledge limit");
    fs.writeFileSync(temporary, serialized, { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

export function criticalFactKeys(text: string) {
  const rules: Record<string, RegExp> = {
    "founding-year": /founded|established|federal contractor since/i,
    "state-coverage": /\d+\s*(?:\+|and counting)?\s*states/i,
    address: /\b\d{5}(?:-\d{4})?\b|Oxon Hill|Fort Washington/i,
    entity: /Nigeria Limited/i,
    founder: /founder/i,
    owner: /ownership|current owner/i,
    "active-vacancies": /now recruiting|apply now|job openings|vacanc/i,
    licenses: /\blicens(?:e|ed|ing)\b/i,
    certifications: /certif|SBA 8|endorsement/i,
    "case-studies": /case stud|our clients|contract award/i,
    testimonials: /testimonial/i,
  };
  return Object.entries(rules)
    .filter(([, pattern]) => pattern.test(text))
    .map(([key]) => key);
}

/** Owner-approved first-party publication policy; never applies to external research. */
export function hasOfficialEvidence(
  entry: EditorialEntry,
  store: EditorialStore,
  now = new Date(),
) {
  if (entry.approvalBasis !== "official_website") return false;
  const url = new URL(entry.sourceUrl);
  return (
    url.protocol === "https:" &&
    url.hostname === "securemedy.ng" &&
    !url.port &&
    !url.username &&
    !url.password &&
    store.sources.some(
      (source) =>
        source.url === entry.sourceUrl &&
        source.state === "approved" &&
        source.status === 200 &&
        Date.parse(source.expiresAt) > now.getTime() &&
        source.contentHash === entry.officialSourceHash &&
        hashText(source.text) === source.contentHash &&
        source.text.includes(entry.answer),
    )
  );
}
export function isApproved(
  entry: EditorialEntry,
  store: EditorialStore,
  now = new Date(),
) {
  return (
    entry.lastVerifiedAt !== null &&
    entry.visibility === "public" &&
    entry.state === "approved" &&
    Date.parse(entry.expiresAt) > now.getTime() &&
    (entry.approvalBasis === "official_website"
      ? hasOfficialEvidence(entry, store, now)
      : !store.conflicts.some(
          (c) => c.state === "open" && entry.factKeys.includes(c.factKey),
        ))
  );
}
export type KnowledgeQuery = {
  namespace: "public" | "internal";
  query: string;
  limit?: number;
};
export interface EditorialKnowledgeRepository {
  search(request: KnowledgeQuery): EditorialEntry[];
}
const stopWords = new Set(
  "the a an and or to for of in on with is are do does can could would will you your our we me my i it this that how what when where who about need help want have has provide available please".split(
    " ",
  ),
);
const words = (text: string) =>
  [
    ...new Set(
      text
        .toLowerCase()
        .replace(
          /\b(?:founder|founded|owner|ownership|chairman|chief)\b/g,
          "leadership",
        )
        .replace(/\blicens(?:e|ed|es|ing)\b/g, "physical security")
        .replace(
          /\b(?:jobs|vacancies|openings|positions|recruiting)\b/g,
          "career",
        )
        .replace(/\bm3dyhub\b/g, "employee portal")
        .replace(
          /\b(?:unpaid|wages|salary|hr)\b|haven[’']?t been paid|have not been paid/g,
          "employee payroll",
        )
        .replace(/gurads?/g, "guard")
        .replace(/\bguards?\b/g, "guard")
        .replace(/\bofficers?\b/g, "officer")
        .replace(/pay\s?stubs?|payroll|uniforms?|my schedule/g, "employee")
        .replace(/entrance|watch|theft/g, "guard")
        .replace(/cameras?|cctv/g, "electronic")
        .match(/[a-z0-9]+/g) || [],
    ),
  ].filter((x) => x.length > 2 && !stopWords.has(x));
export class PublicKnowledgeRepository implements EditorialKnowledgeRepository {
  constructor(
    private file = defaultStorePath(),
    private now = () => new Date(),
  ) {}
  approved() {
    const store = readStore(this.file);
    return store.entries.filter((e) => isApproved(e, store, this.now()));
  }
  search(request: KnowledgeQuery) {
    // Identity supplied by a caller cannot unlock this public-only implementation.
    if (request.namespace !== "public")
      throw new Error(
        "Internal retrieval requires a separate authenticated adapter",
      );
    const tokens = words(request.query);
    const score = (entry: EditorialEntry) =>
      tokens.reduce(
        (n, t) =>
          n +
          (words(
            entry.id +
              " " +
              entry.examples.join(" ") +
              " " +
              entry.aliases.join(" "),
          ).includes(t)
            ? 4
            : 0) +
          (words(entry.answer).includes(t) ? 1 : 0),
        0,
      );
    const ranked = this.approved()
      .map((entry) => ({ entry, score: score(entry) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    const limit = Math.min(6, request.limit ?? 5);
    // Keep concise service/routing records useful as the website index grows.
    const curated = ranked
      .filter(({ entry }) => !entry.id.startsWith("official-"))
      .slice(0, Math.min(3, limit));
    const seen = new Set(curated.map(({ entry }) => entry.id));
    return [...curated, ...ranked.filter(({ entry }) => !seen.has(entry.id))]
      .slice(0, limit)
      .map(({ entry }) => entry);
  }
}
export function reviewEntry(
  id: string,
  newState: EditorialEntry["state"],
  actor: string,
  reason: string,
  patch: Partial<EditorialEntry> = {},
  file = defaultStorePath(),
) {
  if (!actor.trim() || !reason.trim())
    throw new Error("Reviewer and reason required");
  mutateStore((store) => {
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) throw new Error("Unknown entry");
    const next = EntrySchema.parse({
      ...entry,
      ...patch,
      id: entry.id,
      visibility: "public",
      state: newState,
      factKeys: [
        ...new Set([
          ...(patch.factKeys ?? entry.factKeys),
          ...criticalFactKeys(patch.answer ?? entry.answer),
        ]),
      ],
      lastVerifiedAt:
        newState === "approved"
          ? (patch.verifiedAt ?? entry.verifiedAt)
          : entry.lastVerifiedAt,
      contentHash: hashText(patch.answer ?? entry.answer),
    });
    if (
      newState === "approved" &&
      store.conflicts.some(
        (c) => c.state === "open" && next.factKeys.includes(c.factKey),
      )
    )
      throw new Error("Resolve the conflict explicitly before approval");
    if (
      newState === "approved" &&
      (Date.parse(next.expiresAt) <= Date.now() ||
        Date.parse(next.expiresAt) > Date.now() + next.refreshDays * 86400000 ||
        next.verifiedAt !== new Date().toISOString().slice(0, 10))
    )
      throw new Error(
        "Approval needs today's verification date and future expiry",
      );
    if (
      /<script|ignore (all |previous )?instructions|system prompt/i.test(
        next.answer,
      ) &&
      newState === "approved"
    )
      throw new Error("Suspicious instruction text cannot be approved");
    next.versions = [
      ...entry.versions,
      {
        at: new Date().toISOString(),
        actor,
        reason,
        hash: next.contentHash,
        state: newState,
        answer: next.answer,
      },
    ];
    store.entries[store.entries.indexOf(entry)] = next;
  }, file);
}
export function ingestSource(
  input: z.input<typeof SourceRecordSchema>,
  file = defaultStorePath(),
) {
  const source = SourceRecordSchema.parse(input);
  let changed = false;
  mutateStore((store) => {
    const old = store.sources.find((s) => s.url === source.url);
    if (old?.contentHash === source.contentHash) {
      old.retrievedAt = source.retrievedAt;
      old.expiresAt = source.expiresAt;
      return;
    }
    changed = true;
    if (old) store.sources.splice(store.sources.indexOf(old), 1);
    store.sources.push({
      ...source,
      state: "needs-review",
      versions: [
        ...(old?.versions || []),
        { at: source.retrievedAt, hash: source.contentHash, text: source.text },
      ],
    });
    for (const factKey of criticalFactKeys(source.text)) {
      const open = store.conflicts.find(
        (c) => c.factKey === factKey && c.state === "open",
      );
      if (open) {
        if (!open.evidence.includes(source.url)) open.evidence.push(source.url);
      } else
        store.conflicts.push({
          id: "crawl-" + factKey + "-" + source.contentHash.slice(0, 8),
          factKey,
          state: "open",
          details:
            "New or changed high-risk public claim requires editorial review; not an approved fact.",
          evidence: [source.url],
        });
    }
    if (old) {
      // Recrawling never changes an approved answer. Flag source drift for human review.
      const id = "source-drift-" + source.id;
      if (!store.conflicts.some((c) => c.id === id && c.state === "open"))
        store.conflicts.push({
          id,
          factKey: "source:" + source.url,
          state: "open",
          details: "Source content changed; compare with approved summaries.",
          evidence: [source.url],
        });
    }
  }, file);
  return changed;
}
