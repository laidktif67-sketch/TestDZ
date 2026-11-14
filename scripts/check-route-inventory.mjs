import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const routeFile = resolve("apps/web/src/AppRoutes.tsx");
const routeDirectory = resolve("apps/web/src/routes");
const sources = {
  app: readFileSync(routeFile, "utf8"),
  public: readFileSync(resolve(routeDirectory, "publicRoutes.tsx"), "utf8"),
  admin: readFileSync(resolve(routeDirectory, "adminRoutes.tsx"), "utf8"),
  developer: readFileSync(resolve(routeDirectory, "developerRoutes.tsx"), "utf8"),
  tester: readFileSync(resolve(routeDirectory, "testerRoutes.tsx"), "utf8"),
  authenticated: readFileSync(resolve(routeDirectory, "authenticatedRoutes.tsx"), "utf8"),
};

const allRouteSource = Object.values(sources).join("\n");
const routeElementCount = (allRouteSource.match(/<Route\b/g) ?? []).length;
const pathCount = (allRouteSource.match(/<Route\s+(?:key="[^"]+"\s+)?path=/g) ?? []).length;
const errors = [];

const requiredPaths = [
  'path="/"',
  'path="/help-support"',
  'path="/dashboard"',
  'path="/admin/medical-exceptions"',
  'path="/admin/invoices/:invoiceId"',
  'path="/assignments/:id/submit"',
  'path="/apps/:id"',
  'path="*"',
];
const missingPaths = requiredPaths.filter((path) => !allRouteSource.includes(path));

const routeSourceFiles = [
  [routeFile, sources.app],
  [resolve(routeDirectory, "publicRoutes.tsx"), sources.public],
  [resolve(routeDirectory, "adminRoutes.tsx"), sources.admin],
  [resolve(routeDirectory, "developerRoutes.tsx"), sources.developer],
  [resolve(routeDirectory, "testerRoutes.tsx"), sources.tester],
  [resolve(routeDirectory, "authenticatedRoutes.tsx"), sources.authenticated],
];
const importErrors = [];
for (const [file, source] of routeSourceFiles) {
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const specifier = match[1];
    const base = resolve(dirname(file), specifier);
    const candidates = [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      `${base}.jsx`,
      `${base}.js`,
      resolve(base, "index.tsx"),
      resolve(base, "index.ts"),
    ];
    if (!candidates.some((candidate) => existsSync(candidate))) {
      importErrors.push(`${file}: unresolved relative import "${specifier}"`);
    }
  }
}

const declaredPaths = [...allRouteSource.matchAll(/<Route\s+(?:key="[^"]+"\s+)?path="([^"]+)"/g)].map((match) => match[1]);
const duplicatePaths = declaredPaths.filter((path, index) => declaredPaths.indexOf(path) !== index);

const moduleContracts = [
  ["public", "{publicRouteElements}", "export const publicRouteElements", 'import { publicRouteElements } from "./routes/publicRoutes";'],
  ["admin", "{adminRouteElements}", "export const adminRouteElements", 'import { adminRouteElements } from "./routes/adminRoutes";'],
  ["developer", "{developerRouteElements}", "export const developerRouteElements", 'import { developerRouteElements } from "./routes/developerRoutes";'],
  ["authenticated", "{authenticatedRouteElements}", "export const authenticatedRouteElements", 'import { authenticatedRouteElements } from "./routes/authenticatedRoutes";'],
];
for (const [name, composition, declaration, importStatement] of moduleContracts) {
  if (
    !sources.app.includes(composition) ||
    !sources[name].includes(declaration) ||
    !sources.app.includes(importStatement)
  ) {
    errors.push(`The ${name} route module is not correctly imported and composed into AppRoutes.`);
  }
}
if (
  !sources.app.includes("{testerWorkspaceRouteElements}") ||
  !sources.app.includes('import { testerWorkspaceRouteElements } from "./routes/testerRoutes";') ||
  !sources.tester.includes("export const testerWorkspaceRouteElements") ||
  !sources.authenticated.includes("{testerSecurityRouteElements}") ||
  !sources.authenticated.includes('import { testerSecurityRouteElements } from "./testerRoutes";') ||
  !sources.tester.includes("export const testerSecurityRouteElements")
) {
  errors.push("Both tester route groups must be imported and composed inside the appropriate guards.");
}

if (pathCount !== 96) {
  errors.push(`Expected 96 explicit path declarations from the captured baseline, found ${pathCount}.`);
}
if (routeElementCount !== 102) {
  errors.push(`Expected 102 Route elements from the captured baseline, found ${routeElementCount}.`);
}
if (missingPaths.length > 0) {
  errors.push(`Missing required route declarations: ${missingPaths.join(", ")}.`);
}

if (importErrors.length > 0) {
  errors.push(`Unresolved relative imports in route modules: ${importErrors.join("; ")}.`);
}
if (duplicatePaths.length > 0) {
  errors.push(`Duplicate route path declarations: ${[...new Set(duplicatePaths)].join(", ")}.`);
}

const publicRouteIndex = sources.public.indexOf('<Route key="public-1" path="/"');
const publicCompositionIndex = sources.app.indexOf("{publicRouteElements}");
const authGuardIndex = sources.app.indexOf("<Route element={<AuthGuard");
const onboardingGuardIndex = sources.app.indexOf("<Route element={<OnboardingGuard");
const wildcardIndex = sources.app.lastIndexOf('<Route path="*"');
if (
  publicRouteIndex < 0 ||
  publicCompositionIndex < 0 ||
  authGuardIndex < 0 ||
  onboardingGuardIndex < 0 ||
  wildcardIndex < 0 ||
  !(publicCompositionIndex < authGuardIndex && authGuardIndex < onboardingGuardIndex && onboardingGuardIndex < wildcardIndex)
) {
  errors.push("Public routes, auth/onboarding guards, and wildcard route must retain their required ordering.");
}

if (!allRouteSource.includes('<Navigate to="/help" replace />')) {
  errors.push('The /help-support redirect must continue to use Navigate to="/help" with replace.');
}
if (!sources.app.includes('<Navigate to="/" replace />')) {
  errors.push('The wildcard redirect must continue to use Navigate to="/" with replace.');
}
if (!sources.app.includes('<RoleHomeRedirect />')) {
  errors.push("The /dashboard route must continue to use RoleHomeRedirect.");
}
if (!sources.authenticated.includes('requiredRole="tester"')) {
  errors.push("Tester security routes must remain protected by the tester RoleGuard.");
}
if (!sources.app.includes('requiredRole="admin"') || !sources.app.includes('requiredRole="developer"')) {
  errors.push("Admin and developer route groups must remain protected by their role guards.");
}

if (errors.length > 0) {
  console.error("Route inventory check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Route inventory check passed.");
  console.log(`Route elements: ${routeElementCount}; explicit path declarations: ${pathCount}.`);
  console.log("Required route modules, parameters, redirects, and guard ordering are present.");
}
