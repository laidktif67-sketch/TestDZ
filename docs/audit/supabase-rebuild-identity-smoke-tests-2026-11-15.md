# TestDZ-Rebuild identity smoke tests — 2026-11-15

## Target and safety

- Target: isolated Supabase project `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`).
- The legacy `TestDZ` project was not queried for writes or modified.
- All identity smoke tests used transaction-scoped role/JWT claim settings. Read-only probes were rolled back; the mutation-capable RPC probes were rejected by authorization guards before any mutation.
- No migrations were applied during this test pass.

## Results

| Check | Result | Evidence |
|---|---|---|
| Switch to `authenticated` and set a synthetic, non-existent subject | PASS | SQL reported `current_user = authenticated`; JWT claims were transaction-local |
| RLS visibility for `profiles`, `user_roles`, and `wallets` under that subject | PASS (negative visibility smoke test) | 0 rows visible in each empty test table |
| `get_my_active_sessions()` under that subject | PASS (empty result) | 0 rows returned |
| `get_my_security_activity(20)` under that subject | PASS (empty result) | 0 rows returned |
| `create_cohort(...)` as non-admin authenticated subject | PASS (denied as expected) | PostgreSQL error `42501: ADMIN_ONLY` from the RPC guard |
| `add_cohort_test(...)` as non-admin authenticated subject | PASS (denied as expected) | PostgreSQL error `42501: ADMIN_ONLY` from the RPC guard |
| `remove_cohort_test(...)` as non-admin authenticated subject | PASS (denied as expected) | PostgreSQL error `42501: ADMIN_ONLY` from the RPC guard |
| Supabase Security Advisor | REVIEW OPEN | Six authenticated-callable `SECURITY DEFINER` warnings remain |
| Supabase Performance Advisor | PASS for FK coverage; informational notices remain | No `unindexed_foreign_keys` finding after the additive index fix; 71 unused-index notices on the empty/near-empty rebuild |
| Supabase Health Advisor | PASS | No findings returned |

## Interpretation and limits

The three cohort RPC probes demonstrate that a signed-in non-admin identity is rejected by the explicit admin guard. The RLS/function reads demonstrate that a synthetic identity cannot see rows in the currently empty self-scoped tables and that the two self-service Auth RPCs return no rows for that identity.

These are smoke tests, **not** complete authorization certification. The target has no representative fixture rows and no actual Auth users for distinct admin/developer/tester identities. Consequently, they do not prove owner-versus-non-owner isolation with populated rows, administrator positive paths, anonymous behavior for every endpoint, storage upload/delete policy behavior, or complete application workflows. The `create_app_with_distribution` anonymous probe was not counted as a pass because the tool batch surfaced the first expected authorization error before reporting the other calls' results.

## Next gates

1. Add deterministic fixture rows in an isolated transaction or dedicated disposable schema and test separate developer/tester/admin identities, including cross-user read/write denial.
2. Test Storage policies with real authenticated requests, not catalog inspection alone.
3. Keep these four migrations held until dedicated tests and review are complete:
   - `20261109203933_add_private_report_evidence.sql`
   - `20261109204205_index_report_attachments_foreign_keys.sql`
   - `20261113000400_banned_account_enforcement.sql`
   - `20261113000500_admin_account_suspension_appeals.sql`
4. Do not merge to `main`, deploy, or claim production readiness based on these smoke tests.
