import {
  EntrySchema,
  hashText,
  mutateStore,
  criticalFactKeys,
} from "./knowledge-store.js";
import { publicURL } from "./public-crawler.js";
const suspicious =
  /<script|ignore (all |previous )?instructions|system prompt|reveal (?:secrets|credentials)/i;
const reason =
  "Business owner approved publicly published securemedy.ng content for customer-facing answers (2026-10-19). Published claims retain attribution and do not guarantee current availability or legal ownership.";
function chunks(text: string) {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length) {
    let end = Math.min(1400, remaining.length);
    if (end < remaining.length) end = remaining.lastIndexOf(" ", end);
    if (end < 1) end = Math.min(1400, remaining.length);
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  return parts;
}
/** Publish only fresh, successfully fetched, first-party page text; no paid services. */
export function indexOfficialSources(file?: string) {
  const indexed: string[] = [];
  mutateStore((store) => {
    store.entries = store.entries.filter((entry) => {
      if (!entry.id.startsWith("official-")) return true;
      try {
        publicURL(entry.sourceUrl);
        return true;
      } catch {
        return false;
      }
    });
    for (const source of store.sources) {
      let url: URL;
      try {
        url = publicURL(source.url);
      } catch {
        source.state = "withdrawn";
        continue;
      }
      if (
        url.hostname !== "securemedy.ng" ||
        source.status !== 200 ||
        Date.parse(source.expiresAt) <= Date.now() ||
        source.contentHash !== hashText(source.text) ||
        suspicious.test(source.text)
      )
        continue;
      source.state = "approved";
      source.verifiedAt = source.retrievedAt.slice(0, 10);
      const prefix = "official-" + source.id + "-";
      // Replace only machine-indexed chunks for this source; retain historical provenance in source.versions.
      store.entries = store.entries.filter(
        (entry) => !entry.id.startsWith(prefix),
      );
      const put = (
        id: string,
        answer: string,
        factKeys = criticalFactKeys(answer),
      ) => {
        const old = store.entries.find((entry) => entry.id === id);
        const hash = hashText(answer);
        const entry = EntrySchema.parse({
          id,
          topic: url.pathname.includes("career")
            ? "careers"
            : /service/.test(url.pathname)
              ? "services"
              : /industr/.test(url.pathname)
                ? "industries"
                : "company",
          answer,
          sourceUrl: source.url,
          sourceTitle: source.title,
          visibility: "public",
          reviewStatus: "website_verified",
          state: "approved",
          approvalBasis: "official_website",
          officialSourceHash: source.contentHash,
          verifiedAt: source.verifiedAt,
          lastVerifiedAt: source.verifiedAt,
          retrievedAt: source.retrievedAt,
          expiresAt: source.expiresAt,
          refreshDays: source.refreshDays,
          contentHash: hash,
          factKeys,
          examples: old?.examples || [source.title.slice(0, 240)],
          aliases: old?.aliases || [source.title.slice(0, 100)],
          action: old?.action || {
            label: source.title.slice(0, 100),
            url: source.url,
          },
          uncertainty:
            "This is content published by SecureMedy, not independent verification. Dated claims remain historical; job listings, prices, staffing, licensing, coverage and availability must be confirmed. A founder or Chairman title does not establish legal ownership. Conflicting published details must be identified rather than silently reconciled.",
          versions:
            old?.contentHash === hash &&
            old?.approvalBasis === "official_website"
              ? old.versions
              : [
                  ...(old?.versions || []),
                  {
                    at: new Date().toISOString(),
                    actor: "owner-authorized-website-index",
                    reason,
                    hash,
                    state: "approved",
                    answer,
                  },
                ],
        });
        if (old) store.entries[store.entries.indexOf(old)] = entry;
        else store.entries.push(entry);
      };
      chunks(source.text).forEach((answer, i) => put(prefix + i, answer));
      if (url.pathname === "/about-us/") {
        const start = source.text.indexOf("Leadership");
        const end = source.text.indexOf("Affiliations", start);
        if (start >= 0 && end > start && end - start <= 2000)
          put("leadership", source.text.slice(start, end).trim(), [
            "founder",
            "certifications",
          ]);
        const history = source.text.indexOf("2009 Vision");
        const historyEnd = source.text.indexOf("Leadership", history);
        if (
          history >= 0 &&
          historyEnd > history &&
          historyEnd - history <= 2000
        )
          put(
            "company-founded",
            source.text.slice(history, historyEnd).trim(),
            ["founding-year", "state-coverage"],
          );
      }
      indexed.push(source.url);
    }
  }, file);
  return indexed;
}
