import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../apps/web/src", import.meta.url));
const forbidden = /\b(?:supabase|supabaseV2|client)\s*\.\s*(?:from|rpc)\s*\(/;
const violations = [];
const pageDirectories = [];

async function discoverPageDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.name === "pages") pageDirectories.push(absolute);
    await discoverPageDirectories(absolute);
  }
}

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(absolute);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
    const source = await readFile(absolute, "utf8");
    source.split(/\r?\n/).forEach((line, index) => {
      if (forbidden.test(line)) {
        violations.push({ file: path.relative(process.cwd(), absolute), line: index + 1, text: line.trim() });
      }
    });
  }
}

await discoverPageDirectories(sourceRoot);
for (const directory of pageDirectories) await visit(directory);

if (violations.length) {
  console.error("Page data-boundary violations: UI pages must call feature APIs, not Supabase table/RPC methods.");
  for (const item of violations) console.error("- " + item.file + ":" + item.line + ": " + item.text);
  process.exitCode = 1;
} else {
  console.log("Page data-boundary check passed: scanned " + pageDirectories.length + " page directories; no direct Supabase table/RPC calls found.");
}
