import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const listen = (server: Server, port: number) =>
  new Promise<void>((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolveReady());
  });
const close = (server: Server) =>
  new Promise<void>((resolveClosed, reject) =>
    server.close((error) => (error ? reject(error) : resolveClosed())),
  );

export default async function globalSetup() {
  const dataDir = mkdtempSync(join(tmpdir(), "medy-playwright-"));
  process.env.CLIENT_ORIGIN = "http://127.0.0.1:5281";
  process.env.DEMO_MODE = "true";
  process.env.BEDROCK_ENABLED = "false";
  process.env.MEDY_LEADS_FILE = join(dataDir, "leads.json");
  process.env.MEDY_ACTIONS_FILE = join(dataDir, "actions.json");

  const { createApp } = await import("../../apps/api/src/app.js");
  const api = createApp().listen(4281, "127.0.0.1");
  await new Promise<void>((resolveReady, reject) => {
    api.once("listening", resolveReady);
    api.once("error", reject);
  });

  const root = resolve("apps/demo/dist");
  const web = createServer((request, response) => {
    const requested = normalize(
      decodeURIComponent((request.url || "/").split("?")[0]),
    ).replace(/^[/\\]+/, "");
    let file = resolve(root, requested || "index.html");
    try {
      if (!file.startsWith(root) || !statSync(file).isFile())
        file = join(root, "index.html");
    } catch {
      file = join(root, "index.html");
    }
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
    };
    response.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    response.end(readFileSync(file));
  });
  await listen(web, 5281);

  return async () => {
    await Promise.all([close(api), close(web)]);
    rmSync(dataDir, { recursive: true, force: true });
  };
}
