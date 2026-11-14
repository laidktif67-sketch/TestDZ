import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = {
  provider: resolve("apps/web/src/features/identity/identity-provider.tsx"),
  auth: resolve("apps/web/src/shared/guards/AuthGuard.tsx"),
  onboarding: resolve("apps/web/src/shared/guards/OnboardingGuard.tsx"),
  roles: resolve("apps/web/src/shared/guards/RoleGuard.tsx"),
  routes: resolve("apps/web/src/AppRoutes.tsx"),
};

const source = Object.fromEntries(
  Object.entries(files).map(([name, path]) => [name, readFileSync(path, "utf8")])
);
const failures = [];
const checks = [
  ["stale role requests are ignored", () => /requestId === rolesRequestId\.current/.test(source.provider)],
  ["role-load failure clears roles and records an error", () => /setRoles\(\[\]\);\s*setRolesError\(asError\(reason\)\)/.test(source.provider)],
  ["sign-out clears local identity state after successful API sign-out", () => /await identityApi\.signOut\(\)/.test(source.provider) && /setSession\(null\);\s*setRoles\(\[\]\);/.test(source.provider)],
  ["missing session redirects protected routes to auth", () => /if \(!session \|\| !user\)[\s\S]*?<Navigate[\s\S]*?to="\/auth"/.test(source.auth)],
  ["account-status lookup errors fail closed", () => /currentAccountStatus === "error"/.test(source.auth) && /Access remains blocked until your account status can be confirmed/.test(source.auth)],
  ["banned accounts render the suspension screen instead of the protected outlet", () => {
    const bannedBranch = source.auth.match(/if \(currentAccountStatus === "banned"\) \{([\s\S]*?)\n  \}\n\n  return <Outlet \/>;/)?.[1] ?? "";
    return bannedBranch.length > 0 && /Account suspended/.test(bannedBranch) && /return \(/.test(bannedBranch) && !/Outlet/.test(bannedBranch);
  }],
  ["role-query errors display a retry path before granting workspace access", () => /if \(rolesError\) return <RoleLoadError retry=/.test(source.roles) && /roles\.includes\(requiredRole\) \|\| roles\.includes\("admin"\)/.test(source.roles)],
  ["onboarding lookup errors block navigation and expose retry", () => /state\.status === "error"/.test(source.onboarding) && /Access is paused until your account setup can be verified/.test(source.onboarding) && /onClick=\{retry\}/.test(source.onboarding)],
  ["incomplete onboarding redirects to onboarding", () => /if \(!state\.completed\)[\s\S]*?return <Navigate to="\/onboarding" replace/.test(source.onboarding)],
  ["auth and onboarding guards wrap role-protected routes in order", () => {
    const auth = source.routes.indexOf('<Route element={<AuthGuard');
    const onboarding = source.routes.indexOf('<Route element={<OnboardingGuard');
    const admin = source.routes.indexOf('<Route element={<RoleGuard requiredRole="admin"');
    const wildcard = source.routes.lastIndexOf('<Route path="*"');
    return auth >= 0 && onboarding > auth && admin > onboarding && wildcard > admin;
  }],
];

for (const [label, check] of checks) {
  let passed = false;
  try {
    passed = check();
  } catch {
    passed = false;
  }
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failures.push(label);
}

console.log(`\nIdentity guard source-contract audit: ${checks.length - failures.length}/${checks.length} checks passed.`);
console.log("Static source audit only; this does not replace browser runtime tests or backend RLS/RPC tests.");

if (failures.length) process.exitCode = 1;
