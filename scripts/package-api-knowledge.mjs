import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repositoryRoot, "knowledge", "editorial", "store.json");
// TypeScript preserves the source import specifier in dist/src/knowledge-store.js.
const destination = path.join(repositoryRoot, "apps", "knowledge", "editorial", "store.json");
const compiledModule = path.join(repositoryRoot, "apps", "api", "dist", "src", "knowledge-store.js");

if (!fs.existsSync(source)) throw new Error(`Approved knowledge is missing: ${source}`);
if (!fs.existsSync(compiledModule)) throw new Error(`Compiled API is missing: ${compiledModule}`);

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);

process.env.MEDY_PUBLIC_KNOWLEDGE_FILE = destination;
const { readStore } = await import(pathToFileURL(compiledModule).href + `?asset-check=${Date.now()}`);
const store = readStore();
if (!Array.isArray(store.entries) || store.entries.length === 0) {
  throw new Error("Packaged approved knowledge failed its production import smoke check");
}

console.log(`Packaged and verified ${store.entries.length} approved knowledge records.`);
