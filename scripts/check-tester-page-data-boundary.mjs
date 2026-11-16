import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pagesRoot = fileURLToPath(new URL("../apps/web/src/modules/tester/pages", import.meta.url));
const forbidden = /\b(?:supabase|supabaseV2|client)\s*\.\s*(?:from|rpc)\s*\(/;
const violations = [];

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

await visit(pagesRoot);
if (violations.length) {
  console.error("Tester page data-boundary violations: UI pages must call feature APIs, not Supabase table/RPC methods.");
  for (const item of violations) console.error(`- ${item.file}:${item.line}: ${item.text}`);
  process.exitCode = 1;
} else {
  console.log("Tester page data-boundary check passed: no direct Supabase table/RPC calls found.");
}
