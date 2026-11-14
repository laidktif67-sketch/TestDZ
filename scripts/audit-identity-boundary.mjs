import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const sourceRoot = resolve("apps/web/src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const sourceFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const fullPath = resolve(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (extensions.has(extname(fullPath))) {
      sourceFiles.push(fullPath);
    }
  }
}

walk(sourceRoot);

const targets = new Map([
  ["shared/auth/identity-api", resolve(sourceRoot, "shared/auth/identity-api.ts")],
  ["shared/auth/identity-context", resolve(sourceRoot, "shared/auth/identity-context.ts")],
  ["shared/auth/identity-provider", resolve(sourceRoot, "shared/auth/identity-provider.tsx")],
  ["shared/auth/hooks/useIdentity", resolve(sourceRoot, "shared/auth/hooks/useIdentity.ts")],
  ["features/identity/identity-api", resolve(sourceRoot, "features/identity/identity-api.ts")],
  ["features/identity/identity-context", resolve(sourceRoot, "features/identity/identity-context.ts")],
  ["features/identity/identity-provider", resolve(sourceRoot, "features/identity/identity-provider.tsx")],
  ["features/identity/hooks/useIdentity", resolve(sourceRoot, "features/identity/hooks/useIdentity.ts")],
]);

function resolveLocalImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base, ...[...extensions].map((extension) => base + extension),
    ...[...extensions].map((extension) => resolve(base, "index" + extension)),
  ];
  return candidates.find((candidate) => sourceFiles.includes(candidate)) ?? null;
}

const consumers = new Map([...targets.keys()].map((key) => [key, new Set()]));
const featureToShared = [];
const imports = [];

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      const resolved = resolveLocalImport(file, specifier);
      if (!resolved) continue;

      const targetKey = [...targets].find(([, target]) => target === resolved)?.[0];
      if (!targetKey) continue;

      const importer = file.replace(sourceRoot + "/", "");
      consumers.get(targetKey).add(importer);
      imports.push({ importer, target: targetKey, specifier });

      if (importer.startsWith("features/") && targetKey.startsWith("shared/auth/")) {
        featureToShared.push({ importer, target: targetKey });
      }
    }
  }
}

console.log("Identity boundary import audit");
console.log(`Scanned source files: ${sourceFiles.length}`);
console.log("\nDirect consumers by identity module:");
for (const [key, files] of consumers) {
  console.log(`\n${key}: ${files.size}`);
  for (const file of [...files].sort()) console.log(`  - ${file}`);
}
console.log(`\nMatched identity imports: ${imports.length}`);
console.log(`Feature-to-shared/auth imports: ${featureToShared.length}`);
for (const edge of featureToShared) {
  console.log(`  - ${edge.importer} -> ${edge.target}`);
}
console.log("\nThis is an inventory report, not an authorization or runtime test.");
