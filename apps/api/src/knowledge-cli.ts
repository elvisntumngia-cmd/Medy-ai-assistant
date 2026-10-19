import fs from "node:fs";
import path from "node:path";
import {
  EntrySchema,
  defaultStorePath,
  hashText,
  mutateStore,
  readStore,
  reviewEntry,
  repositoryRoot,
  PublicKnowledgeRepository,
} from "./knowledge-store.js";
import { indexOfficialSources } from "./official-knowledge.js";
import { crawlPublic } from "./public-crawler.js";
const [command, input] = process.argv.slice(2);
try {
  const file = defaultStorePath();
  if (command === "inventory") {
    const store = readStore(file);
    console.log(
      JSON.stringify(
        {
          revision: store.revision,
          entries: store.entries.map((e) => ({
            id: e.id,
            state: e.state,
            source: e.sourceUrl,
            expiresAt: e.expiresAt,
            factKeys: e.factKeys,
          })),
          sources: store.sources.map((s) => ({
            url: s.url,
            title: s.title,
            state: s.state,
            hash: s.contentHash,
            retrievedAt: s.retrievedAt,
          })),
          conflicts: store.conflicts,
        },
        null,
        2,
      ),
    );
  } else if (command === "crawl" || command === "refresh") {
    const seeds = fs
      .readFileSync(
        path.join(repositoryRoot(), "knowledge/editorial/crawl-seeds.txt"),
        "utf8",
      )
      .split(/\r?\n/)
      .filter((s) => s.startsWith("https://"));
    const report = await crawlPublic(
      command === "refresh"
        ? seeds.filter((seed) => new URL(seed).hostname === "securemedy.ng")
        : seeds,
      { maxPages: 40 },
    );
    const indexed = command === "refresh" ? indexOfficialSources(file) : [];
    fs.writeFileSync(
      path.join(repositoryRoot(), "knowledge/editorial/crawl-report.json"),
      JSON.stringify(
        { at: new Date().toISOString(), ...report, indexed },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ ...report, indexed }));
  } else if (command === "review") {
    if (!input) throw new Error("Supply a local JSON review file");
    const action = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
    reviewEntry(
      action.id,
      action.state,
      action.actor,
      action.reason,
      action.patch || {},
      file,
    );
    console.log("Review recorded. No deployment or outbound action performed.");
  } else if (command === "add") {
    if (!input) throw new Error("Supply a local FAQ JSON file");
    const value = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
    const answer = String(value.answer || "");
    const now = new Date().toISOString();
    const entry = EntrySchema.parse({
      ...value,
      state: "needs-review",
      visibility: "public",
      retrievedAt: now,
      contentHash: hashText(answer),
      versions: [
        {
          at: now,
          actor: "local-import",
          reason: "Manual candidate; approval requires separate review.",
          hash: hashText(answer),
          state: "needs-review",
          answer,
        },
      ],
    });
    mutateStore((store) => {
      if (store.entries.some((e) => e.id === entry.id))
        throw new Error("Use review with a patch to edit an existing entry");
      store.entries.push(entry);
    }, file);
    console.log("Candidate added; not published.");
  } else if (command === "resolve") {
    if (!input) throw new Error("Supply a local conflict-resolution JSON file");
    const value = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
    if (!value.actor?.trim() || !value.reason?.trim())
      throw new Error("Reviewer and resolution evidence required");
    mutateStore((store) => {
      const c = store.conflicts.find((c) => c.id === value.id);
      if (!c) throw new Error("Unknown conflict");
      c.state = "resolved";
      c.resolution = value.reason;
      c.resolvedBy = value.actor;
      for (const entry of store.entries.filter(
        (e) => e.factKeys.includes(c.factKey) && e.state === "approved",
      )) {
        entry.state = "needs-review";
        entry.versions.push({
          at: new Date().toISOString(),
          actor: value.actor,
          reason: "Conflict resolved; fresh entry approval still required.",
          hash: entry.contentHash,
          state: "needs-review",
          answer: entry.answer,
        });
      }
    }, file);
    console.log(
      "Conflict resolution recorded. Entries still require separate approval.",
    );
  } else if (command === "export") {
    const store = readStore(file);
    const snapshot = {
      schemaVersion: 1,
      revision: store.revision,
      entries: new PublicKnowledgeRepository(file)
        .approved()
        .map((entry) => ({ ...entry, versions: entry.versions.slice(-1) })),
      sources: store.sources.filter(
        (source) =>
          source.state === "approved" &&
          new PublicKnowledgeRepository(file)
            .approved()
            .some((entry) => entry.officialSourceHash === source.contentHash),
      ),
      conflicts: store.conflicts.map((conflict) => ({
        ...conflict,
        details: "Editorial review state retained; research text excluded.",
        evidence: [],
      })),
      links: store.links,
    };
    if (input) {
      const output = path.resolve(input);
      if (output === path.resolve(file))
        throw new Error("Cannot overwrite editorial store with runtime export");
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + "\n");
      console.log("Approved-only runtime snapshot exported locally.");
    } else console.log(JSON.stringify(snapshot, null, 2));
  } else
    throw new Error(
      "Use inventory | crawl | refresh | add FILE | review FILE | resolve FILE | export",
    );
} catch {
  // Do not print candidate text or error objects that may contain imported PII.
  console.error(
    "Knowledge command failed. Validate the command/input, permissions, expiry dates and unresolved conflicts. No API or deployment was invoked.",
  );
  process.exitCode = 1;
}
