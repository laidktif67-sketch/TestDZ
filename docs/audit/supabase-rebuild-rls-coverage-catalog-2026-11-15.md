# TestDZ-Rebuild — RLS coverage catalog check (2026-11-15)

Target: isolated project `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`) only.

## Read-only catalog result

A catalog query checked ordinary tables in schemas `public` and `storage`, reporting RLS enabled/forced state and policy counts.

- **No ordinary table in `public` was returned as having RLS disabled.** This is a useful coverage baseline, not proof that each policy is correct.
- `storage.objects` has RLS enabled and **12 policies** in the current catalog.
- The other listed internal Storage metadata tables also have RLS enabled; several have zero policies, which is not by itself evidence of a defect because access may be handled through Storage service paths/privileges rather than direct client table access.

## Interpretation and next gate

RLS enabled is necessary but not sufficient: a permissive policy can still expose another user's rows, and a restrictive policy can block legitimate operations. The next meaningful validation is real API behavior with separate temporary Auth identities and disposable fixtures.

No schema or data was changed by this query. No Auth users or Storage objects were created. The legacy `TestDZ` database was not touched. The four held migrations remain unapplied.
