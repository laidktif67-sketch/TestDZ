# TestDZ-Rebuild: isolated RPC authorization probes — 2026-11-15

## Scope and safety

- Target: Supabase test project `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`) only.
- The legacy `TestDZ` project was not queried or changed.
- No migrations, persistent fixtures, Auth users, or Storage objects were created.
- These probes use PostgreSQL role/JWT settings through the SQL execution interface. They are useful authorization smoke checks, not substitutes for requests made through the Supabase Auth/PostgREST/Storage HTTP APIs.

## Results

### 1. Anonymous call to `public.create_app_with_distribution(...)`

Executed in a transaction with `SET LOCAL ROLE anon`, invoking the function with syntactically valid arguments.

**Observed:** PostgreSQL rejected the call with `42501: permission denied for function create_app_with_distribution`.

**Interpretation:** The anonymous role cannot execute this RPC. This is an expected deny result. The function ACL previously inspected lists `postgres`, `service_role`, and `authenticated`, but not `anon`.

### 2. Authenticated role without a user identity

Executed in a transaction with `SET LOCAL ROLE authenticated` and `SET LOCAL request.jwt.claims = '{}'`, invoking the same RPC.

**Observed:** The function body rejected the request with `28000: AUTH_REQUIRED`.

**Interpretation:** The RPC explicitly rejects a missing `auth.uid()`. This confirms the guard executes for the simulated no-identity case; it does not establish that real signed-in users can successfully create an app.

## Function review observations

Catalog inspection showed these six SECURITY DEFINER RPCs have an empty `search_path` and explicit EXECUTE grants to `authenticated` (plus owner/service role):
- `create_app_with_distribution(text,text,text,text,text)`
- `create_cohort(text,integer,uuid[])`
- `add_cohort_test(uuid,uuid)`
- `remove_cohort_test(uuid,uuid)`
- `get_my_active_sessions()`
- `get_my_security_activity(integer)`

Previously recorded simulated non-admin calls to the three cohort-management RPCs were rejected with `42501: ADMIN_ONLY`. The self-service session/activity RPCs returned no rows for a synthetic UUID in an empty test database. Those results remain smoke evidence only.

## Still required before approving these RPCs

1. Test with real temporary Auth users through PostgREST, with safe cleanup and no service-role key exposed in client code.
2. Verify owner versus non-owner isolation using disposable fixture rows, including positive-path behavior for an authorized admin.
3. Verify `create_app_with_distribution` creates only an app owned by the caller and rejects invalid URLs; assert no row remains after failed calls.
4. Test Storage policies through the Storage HTTP API with separate uploader, owner/participant, and unrelated-user identities.
5. Re-run Security Advisor and review each of its six SECURITY DEFINER warnings against intended access; do not remove grants merely to silence warnings.

## Status

**Partial authorization smoke checks passed for the expected deny cases.** This is not a full RLS, Auth, or Storage behavioral test suite, and it does not establish production readiness. The four previously held migrations remain unapplied.
