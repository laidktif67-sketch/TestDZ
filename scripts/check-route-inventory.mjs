import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeFile = resolve("apps/web/src/AppRoutes.tsx");
const source = readFileSync(routeFile, "utf8");
const routeElementCount = (source.match(/<Route\b/g) ?? []).length;
const pathCount = (source.match(/<Route\s+path=/g) ?? []).length;

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

const missingPaths = requiredPaths.filter((path) => !source.includes(path));
const publicRouteIndex = source.indexOf('<Route path="/"');
const authGuardIndex = source.indexOf("<Route element={<AuthGuard");
const onboardingGuardIndex = source.indexOf("<Route element={<OnboardingGuard");
const wildcardIndex = source.lastIndexOf('<Route path="*"');

const errors = [];

if (pathCount !== 96) {
  errors.push(`Expected 96 explicit path declarations from the captured baseline, found ${pathCount}.`);
}

if (routeElementCount < pathCount) {
  errors.push(`Route element count (${routeElementCount}) is lower than explicit path count (${pathCount}).`);
}

if (missingPaths.length > 0) {
  errors.push(`Missing required route declarations: ${missingPaths.join(", ")}.`);
}

if (
  publicRouteIndex < 0 ||
  authGuardIndex < 0 ||
  onboardingGuardIndex < 0 ||
  wildcardIndex < 0 ||
  !(publicRouteIndex < authGuardIndex && authGuardIndex < onboardingGuardIndex && onboardingGuardIndex < wildcardIndex)
) {
  errors.push("Public/auth/onboarding/wildcard route ordering or guard nesting markers changed.");
}

if (!source.includes('<Navigate to="/help" replace />')) {
  errors.push('The /help-support redirect must continue to use Navigate to="/help" with replace.');
}

if (!source.includes('<Navigate to="/" replace />')) {
  errors.push('The wildcard redirect must continue to use Navigate to="/" with replace.');
}

if (!source.includes('<RoleHomeRedirect />')) {
  errors.push("The /dashboard route must continue to use RoleHomeRedirect.");
}

if (errors.length > 0) {
  console.error("Route inventory check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Route inventory check passed.");
  console.log(`Route elements: ${routeElementCount}; explicit path declarations: ${pathCount}.`);
  console.log("Required route parameters, redirect markers, and guard ordering are present.");
}
