import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import {
  hashText,
  ingestSource,
  mutateStore,
  type EditorialStore,
} from "./knowledge-store.js";
export const CRAWL_AGENT = "MedyPublicResearch/1.0";
const hosts = new Set([
  "securemedy.ng",
  "www.securemedy.ng",
  "securemedy.com",
  "www.securemedy.com",
]);
export function publicURL(value: string, base?: string) {
  const url = new URL(value, base);
  const decoded = decodeURIComponent(decodeURIComponent(url.pathname));
  if (
    url.protocol !== "https:" ||
    !hosts.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    /(?:wp-admin|wp-login|wp-json|xmlrpc|login|signin|sign-in|logout|portal|employee|applicant|application|apply|account|admin|feed|comment|search|uploads|hello-world|sample-page|\.pdf|\.zip)/i.test(
      decoded,
    )
  )
    throw new Error("URL outside public crawl scope");
  url.hash = "";
  return url;
}
const blocks = new net.BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocks.addSubnet(ip, bits, "ipv4");
const specialV6 = new net.BlockList();
for (const [address, prefix] of [
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  specialV6.addSubnet(address, prefix, "ipv6");
export function publicAddress(address: string) {
  if (net.isIP(address) === 4) return !blocks.check(address, "ipv4");
  return (
    net.isIP(address) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(address) &&
    !specialV6.check(address, "ipv6")
  );
}
export type FetchResult = {
  status: number;
  url: string;
  type: string;
  body: string;
};
export type PageFetcher = (url: URL) => Promise<FetchResult>;
/** DNS is validated AND pinned to the request, not checked and then resolved a second time. */
export const fetchPublic: PageFetcher = async (url) => {
  publicURL(url.href);
  const addresses = await new Promise<{ address: string; family: number }[]>(
    (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("DNS timeout")), 5000);
      dns
        .lookup(url.hostname, { all: true })
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    },
  );
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Nonpublic DNS destination");
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": CRAWL_AGENT,
          Accept: "text/html,application/xml,text/plain",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, _options, callback) => {
          const first = addresses[0];
          callback(null, first.address, first.family);
        },
        timeout: 10000,
        autoSelectFamily: false,
      } as https.RequestOptions & { autoSelectFamily: boolean },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          response.resume();
          const location = response.headers.location;
          if (!location)
            return reject(new Error("Redirect missing destination"));
          return resolve({
            status,
            url: publicURL(location, url.href).href,
            type: "redirect",
            body: "",
          });
        }
        const type = String(response.headers["content-type"] || "");
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          response.resume();
          return reject(new Error("Encoded response excluded"));
        }
        if (!/text\/(?:html|plain)|(?:application|text)\/xml/.test(type)) {
          response.resume();
          return reject(new Error("Unsupported content type"));
        }
        if (Number(response.headers["content-length"] || 0) > 512000) {
          response.destroy();
          return reject(new Error("Page too large"));
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 512000) {
            response.destroy();
            reject(new Error("Page too large"));
          } else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status,
            url: url.href,
            type,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("aborted", () => reject(new Error("Response aborted")));
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error("Fetch deadline")),
      12000,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("timeout", () => request.destroy(new Error("Fetch timeout")));
    request.on("error", reject);
    request.end();
  });
};
type RobotGroup = {
  agents: string[];
  rules: { allow: boolean; path: string }[];
  delay: number;
};
export function robotPolicy(text: string) {
  const groups: RobotGroup[] = [];
  let current: RobotGroup | undefined;
  let hasRules = false;
  const sitemaps: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const pos = line.indexOf(":");
    if (pos < 0) continue;
    const key = line.slice(0, pos).toLowerCase();
    const value = line.slice(pos + 1).trim();
    if (key === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || hasRules) {
        current = { agents: [], rules: [], delay: 1 };
        groups.push(current);
        hasRules = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (current && ["allow", "disallow", "crawl-delay"].includes(key)) {
      hasRules = true;
      if (key === "crawl-delay") {
        const delay = Number(value);
        if (Number.isFinite(delay) && delay >= 0)
          current.delay = Math.max(1, delay);
      } else if (value)
        current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && CRAWL_AGENT.toLowerCase().includes(a)),
  );
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  const rules = selected.flatMap((g) => g.rules);
  return {
    sitemaps,
    delay: Math.max(1, ...selected.map((g) => g.delay)),
    allows: (pathname: string) => {
      const matches = rules.filter((r) => {
        const pattern = r.path
          .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*");
        return new RegExp("^" + pattern).test(pathname);
      });
      matches.sort(
        (a, b) =>
          b.path.replace(/\*/g, "").length - a.path.replace(/\*/g, "").length ||
          Number(b.allow) - Number(a.allow),
      );
      return matches[0]?.allow ?? true;
    },
  };
}
type Node = DefaultTreeAdapterMap["node"];
const forbidden = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "input",
  "textarea",
  "button",
  "nav",
  "header",
  "footer",
  "aside",
  "svg",
  "template",
]);
export function extractPage(html: string, url: string) {
  const doc = parse(html);
  let title = "";
  let main: Node | undefined;
  const links: string[] = [];
  const walk = (node: Node, extract: boolean): string => {
    if ("tagName" in node) {
      const attrs = Object.fromEntries(
        node.attrs.map((a) => [a.name, a.value]),
      );
      if (
        forbidden.has(node.tagName) ||
        /comment|applicant|submission|cookie|menu|sidebar|byline|author|post-meta|entry-meta/i.test(
          attrs.id + " " + attrs.class,
        )
      )
        return "";
      if (node.tagName === "main" || attrs.role === "main") main = node;
      if (node.tagName === "a" && attrs.href)
        try {
          links.push(publicURL(attrs.href, url).href);
        } catch {
          /* excluded */
        }
      if (node.tagName === "title")
        title = (
          "childNodes" in node
            ? node.childNodes.map((n) => ("value" in n ? n.value : "")).join("")
            : ""
        ).trim();
    }
    if ("value" in node) return extract ? node.value : "";
    return "childNodes" in node
      ? node.childNodes.map((n) => walk(n, extract)).join(" ")
      : "";
  };
  walk(doc, false);
  const text = walk(main || doc, true)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24000);
  return {
    title: title.slice(0, 240) || url,
    text,
    links: [...new Set(links)],
  };
}
export type CrawlOptions = {
  maxPages?: number;
  maxRequests?: number;
  fetcher?: PageFetcher;
  wait?: (ms: number) => Promise<void>;
  storeFile?: string;
};
export async function crawlPublic(seeds: string[], options: CrawlOptions = {}) {
  const fetcher = options.fetcher || fetchPublic;
  const wait = options.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxPages = Math.min(40, Math.max(1, options.maxPages ?? 24));
  const maxRequests = Math.min(100, options.maxRequests ?? 70);
  const policies = new Map<string, ReturnType<typeof robotPolicy>>();
  const deferred = new Set<string>();
  const last = new Map<string, number>();
  const failures: { url: string; reason: string }[] = [];
  const queue = seeds.map((s) => publicURL(s).href);
  const seen = new Set<string>();
  const sitemapSeen = new Set<string>();
  let requests = 0;
  let pages = 0;
  async function request(url: URL) {
    if (requests >= maxRequests)
      throw new Error("Crawl request budget reached");
    const delay = policies.get(url.origin)?.delay ?? 1;
    if (delay > 10) throw new Error("Crawl delay too long; host deferred");
    const remaining = delay * 1000 - (Date.now() - (last.get(url.origin) || 0));
    if (remaining > 0) await wait(remaining);
    requests++;
    last.set(url.origin, Date.now());
    return fetcher(url);
  }
  async function policy(url: URL) {
    if (deferred.has(url.origin)) throw new Error("Host deferred");
    if (policies.has(url.origin)) return policies.get(url.origin)!;
    let result: FetchResult;
    try {
      result = await request(new URL("/robots.txt", url.origin));
    } catch (error) {
      deferred.add(url.origin);
      throw error;
    }
    if (result.status === 404) {
      const p = robotPolicy("");
      policies.set(url.origin, p);
      return p;
    }
    if (result.status !== 200 || result.type === "redirect") {
      deferred.add(url.origin);
      throw new Error("Robots unavailable; host deferred");
    }
    const p = robotPolicy(result.body);
    policies.set(url.origin, p);
    return p;
  }
  async function fetchAllowed(
    value: string,
    redirects = 0,
  ): Promise<FetchResult> {
    const url = publicURL(value);
    const p = await policy(url);
    if (!p.allows(url.pathname)) throw new Error("Disallowed by robots");
    const result = await request(url);
    if (result.status === 429 || result.status === 503) {
      deferred.add(url.origin);
      throw new Error("Host rate limited or unavailable; deferred");
    }
    if (result.type === "redirect") {
      if (redirects >= 3) throw new Error("Too many redirects");
      return fetchAllowed(result.url, redirects + 1);
    }
    return result;
  }
  async function sitemap(value: string, depth = 0): Promise<void> {
    if (depth > 2 || sitemapSeen.size >= 8 || sitemapSeen.has(value)) return;
    sitemapSeen.add(value);
    try {
      const result = await fetchAllowed(value);
      if (result.status !== 200) return;
      const locations = [...result.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
        .map((m) => m[1].replace(/&amp;/g, "&"))
        .slice(0, 200);
      for (const loc of locations) {
        try {
          const url = publicURL(loc).href;
          if (/\.xml$/.test(new URL(url).pathname))
            await sitemap(url, depth + 1);
          else queue.push(url);
        } catch {
          /* outside scope */
        }
      }
    } catch {
      failures.push({ url: value, reason: "Sitemap unavailable or excluded" });
    }
  }
  for (const origin of [...new Set(queue.map((s) => new URL(s).origin))]) {
    try {
      const p = await policy(new URL(origin));
      for (const map of p.sitemaps.length
        ? p.sitemaps
        : [origin + "/sitemap.xml"])
        await sitemap(map);
    } catch {
      failures.push({
        url: origin + "/robots.txt",
        reason: "Robots unavailable; no pages fetched from this origin",
      });
    }
  }
  while (queue.length && pages < maxPages && requests < maxRequests) {
    const value = queue.shift()!;
    if (seen.has(value)) continue;
    seen.add(value);
    try {
      const result = await fetchAllowed(value);
      const now = new Date().toISOString();
      mutateStore((store) => {
        store.links = store.links.filter((l) => l.url !== value);
        store.links.push({
          url: value,
          checkedAt: now,
          status: result.status,
          finalUrl: result.url,
        });
      }, options.storeFile);
      if (result.status !== 200 || !result.type.includes("html")) {
        failures.push({ url: value, reason: "Not a live HTML page" });
        continue;
      }
      const page = extractPage(result.body, result.url);
      pages++;
      queue.push(...page.links.slice(0, 60));
      if (page.text.length < 80) continue;
      ingestSource(
        {
          id: hashText(result.url).slice(0, 16),
          url: result.url,
          title: page.title,
          category: new URL(result.url).pathname.split("/")[1] || "company",
          retrievedAt: now,
          contentHash: hashText(page.text),
          text: page.text,
          state: "needs-review",
          verifiedAt: null,
          refreshDays: 30,
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          status: result.status,
          versions: [],
        },
        options.storeFile,
      );
    } catch {
      failures.push({
        url: value,
        reason: "Excluded, robots/network failure, or limit reached",
      });
    }
  }
  return {
    pages,
    requests,
    discovered: seen.size,
    pending: queue.length,
    failures,
  };
}
export function usableLink(
  url: string,
  store: EditorialStore,
  now = Date.now(),
) {
  // Employee portal is an approved routing-only destination, never crawled or ingested.
  if (url === "https://my.securemedy.com/") return true;
  try {
    publicURL(url);
  } catch {
    return false;
  }
  const record = store.links.find((l) => l.url === url);
  return (
    !!record &&
    record.status === 200 &&
    now - Date.parse(record.checkedAt) < 30 * 86400000 &&
    hosts.has(new URL(record.finalUrl).hostname)
  );
}
