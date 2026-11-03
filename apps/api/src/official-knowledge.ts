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
  "Business owner approved publicly published Securemedy website content for customer-facing answers. Published claims retain attribution and do not guarantee current availability or legal ownership.";
const activeHost = "new.securemedy.com";
const stablePages: Record<
  string,
  { ids: string[]; label: string; actionUrl?: string; aliases?: string[] }
> = {
  "/about/": {
    ids: ["company-overview"],
    label: "About Securemedy",
    aliases: [
      "about Securemedy",
      "tell me about Securemedy",
      "company background",
      "what is Securemedy",
    ],
  },
  "/about/leadership/": {
    ids: ["leadership"],
    label: "Meet Our Leadership",
  },
  "/about/mission/": {
    ids: ["mission-vision", "company-motto"],
    label: "Our Mission, Vision and Values",
  },
  "/about/our-story/": {
    ids: ["company-founded"],
    label: "Read Our Story",
  },
  "/about/standards-commitments/": {
    ids: ["company-licensing"],
    label: "View Standards and Commitments",
  },
  "/services/": {
    ids: ["services-overview", "specialized-services"],
    label: "Explore Our Security Services",
    aliases: ["services", "security solutions", "event security"],
  },
  "/services/security-personnel/": {
    ids: ["physical-security", "personnel-security", "concierge-security"],
    label: "Learn About Security Personnel",
    aliases: [
      "guards",
      "security officers",
      "armed and unarmed",
      "front desk",
      "visitor screening",
      "concierge",
    ],
  },
  "/services/security-technology/": {
    ids: ["electronic-security"],
    label: "Explore Security Technology",
    aliases: ["cameras", "CCTV", "access control", "electronic security"],
  },
  "/services/risk-management/": {
    ids: ["risk-management", "emergency-management"],
    label: "Learn About Risk Management",
    aliases: [
      "risk assessment",
      "vulnerability",
      "emergency planning",
      "continuity planning",
    ],
  },
  "/industries/": {
    ids: ["industries"],
    label: "Explore Industries We Serve",
    aliases: [
      "industries",
      "facilities",
      "warehouse",
      "healthcare",
      "education",
    ],
  },
  "/industries/government-public-sector/": {
    ids: ["industry-government"],
    label: "Explore Government Security Solutions",
  },
  "/industries/healthcare/": {
    ids: ["industry-healthcare"],
    label: "Learn About Healthcare Security",
  },
  "/industries/corporate-commercial/": {
    ids: ["industry-commercial"],
    label: "Explore Commercial Security Solutions",
  },
  "/industries/construction/": {
    ids: ["industry-construction"],
    label: "Learn About Construction Site Security",
  },
  "/industries/education/": {
    ids: ["industry-education"],
    label: "Learn About Education Security",
  },
  "/industries/retail-loss-prevention/": {
    ids: ["industry-retail"],
    label: "Explore Retail and Loss Prevention",
  },
  "/industries/hospitality-events/": {
    ids: ["industry-hospitality-events"],
    label: "Explore Hospitality and Event Security",
  },
  "/industries/residential-communities/": {
    ids: ["industry-residential"],
    label: "Learn About Residential Community Security",
  },
  "/industries/industrial-manufacturing/": {
    ids: ["industry-industrial"],
    label: "Explore Industrial and Manufacturing Security",
  },
  "/industries/transportation-logistics/": {
    ids: ["industry-logistics"],
    label: "Explore Transportation and Logistics Security",
  },
  "/careers/": {
    ids: ["careers"],
    label: "View Current Opportunities",
    aliases: ["jobs", "careers", "vacancies", "hiring"],
  },
  "/contact/": {
    ids: ["company-contact"],
    label: "Contact Our Team",
    aliases: ["phone", "email", "address", "office", "contact"],
  },
  "/resources/employee-resources/": {
    ids: ["employee-portal"],
    label: "Employee Login",
    actionUrl: "https://my.securemedy.com/",
    aliases: ["employee portal", "payroll", "pay stubs", "HR"],
  },
  "/m3dyhub-privacy-policy/": {
    ids: ["privacy"],
    label: "View Privacy Policy",
  },
};
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
    const stableIds = new Set(
      Object.values(stablePages).flatMap(({ ids }) => ids),
    );
    for (const source of store.sources) {
      if (new URL(source.url).hostname !== activeHost) {
        source.state = "withdrawn";
        source.verifiedAt = null;
      }
    }
    for (const entry of store.entries) {
      if (new URL(entry.sourceUrl).hostname === activeHost) continue;
      entry.state = "withdrawn";
      entry.lastVerifiedAt = null;
      if (stableIds.has(entry.id))
        entry.id =
          "historical-" +
          entry.id +
          "-" +
          hashText(entry.sourceUrl).slice(0, 8);
    }
    for (const conflict of store.conflicts) {
      if (
        conflict.state === "open" &&
        (conflict.factKey.startsWith("source:") ||
          [
            "founding-year",
            "state-coverage",
            "address",
            "entity",
            "founder",
            "licenses",
            "certifications",
          ].includes(conflict.factKey))
      ) {
        conflict.state = "resolved";
        conflict.resolution =
          "Legacy authorities retired. Active public answers now use the owner-authorized new.securemedy.com snapshot and retain its published dates and qualifications.";
        conflict.resolvedBy = "new-securemedy-authority-migration";
      }
    }
    store.entries = store.entries.filter((entry) => {
      if (!entry.id.startsWith("official-")) return true;
      return (
        new URL(entry.sourceUrl).hostname === activeHost &&
        store.sources.some(
          (source) =>
            source.url === entry.sourceUrl && source.state !== "withdrawn",
        )
      );
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
        url.hostname !== activeHost ||
        source.state === "withdrawn" ||
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
      const stable = stablePages[url.pathname];
      if (stable) {
        for (const id of stable.ids) {
          put(id, chunks(source.text)[0]);
          const entry = store.entries.find((item) => item.id === id)!;
          entry.aliases = [
            stable.label,
            source.title.slice(0, 100),
            ...(stable.aliases || []),
            ...id.split("-"),
          ];
          entry.action = {
            label: stable.label,
            url: stable.actionUrl || source.url,
          };
        }
      }
      if (url.pathname.startsWith("/careers/jobs/")) {
        const end = source.text.indexOf(" Overview");
        if (end > 0 && end < 2000) {
          const id =
            "official-job-" + url.pathname.split("/").filter(Boolean).at(-1);
          put(id, source.text.slice(0, end));
          const listing = store.entries.find((entry) => entry.id === id)!;
          listing.aliases = [
            "jobs",
            "vacancies",
            "careers",
            source.title.slice(0, 100),
          ];
          listing.action = {
            label: "View Role: " + source.title.split(/\s[\u2013|]\s/)[0],
            url: source.url,
          };
          listing.expiresAt = new Date(
            Math.min(
              Date.parse(source.expiresAt),
              Date.parse(source.retrievedAt) + 86400000,
            ),
          ).toISOString();
          listing.uncertainty =
            "Publicly listed role at the last refresh, not a confirmed current vacancy. No reliable live status or expiry feed is published. Confirm availability and application instructions on the official Careers page.";
        }
      }
      indexed.push(source.url);
    }
  }, file);
  return indexed;
}
