# TestDZ database rebuild v2 — candidate

## Status

This is an isolated rebuild candidate, not a production migration.

- Working branch: `rebuild/testdz-v2`
- Base: PR #18 head `24bcaa1c01db69db1c15b55bca992ea9f3feaff0` (PR #18 remains open, draft, and unmerged).
- Supabase validation project: `TestDZ-FixLab` (`bxjqwqidmxxnsgnpyzxv`, eu-west-3).
- Candidate schema: `rebuild_v2`; helper schema: `rebuild_v2_private`.
- Source scripts: `supabase/rebuild-v2/001_schema.sql`, `002_security.sql`, `003_app_lifecycle.sql`, and `004_identity_sessions.sql`, and `005_support_notifications.sql`.
- These scripts are intentionally outside `supabase/migrations` until application compatibility and clean replay tests are complete.

## Candidate model

The candidate contains 43 tables grouped around:

1. Identity and authorization: profiles, user roles, role requests, devices.
2. Product catalogue and test design: apps, tests, steps, requirements, media.
3. Test operations: cohorts, cohort-test membership, assignments, check-ins, feedback, medical exceptions, Play opt-in events.
4. Trust and moderation: reports, report attachments, disputes, fraud events/reviews, immutable audit events.
5. Finance: wallets, immutable wallet ledger, plans, subscriptions, payments, refunds, coupons and redemptions, referrals.
6. Support and platform operations: support tickets, messages, attachments, events, notifications, feature usage, event queue, platform configuration.
7. Developer feedback workflow: messages, reviews, events, attachments.

## Security decisions

- RLS is enabled and forced on every candidate table.
- All 43 tables have at least one explicit policy (44 policies total).
- No direct table-level client write grants are issued. Profile self-service updates are limited to display name, avatar, bio, locale, phone, and interests.
- Signup creates only the default `tester` role and a wallet. User metadata is not used to assign privileged roles.
- `admin`, `financial`, and `support` are never self-selectable. Admin bootstrap is an out-of-band trusted operation; an existing admin may grant non-admin staff roles.
- Developer access is requested and reviewed through a role-request workflow.
- Internal support notes and their attachments are hidden from ticket owners.
- Wallet entries are append-only, idempotent, row-locked, balance-checked, and audited. Only admin/financial roles can post them.
- Security-definer helpers live in the private schema, have fixed search paths, and are not executable by anon.

## Validation completed

- Applied candidate schema, security, developer app lifecycle, onboarding/account-security, support, and notification RPC scripts in the isolated FixLab schema.
- Replayed all three scripts into a second isolated schema, `rebuild_v2_replay`, to check reproducibility.
- Replay result: 43 tables, 43 forced-RLS tables, 44 policies covering all 43 tables, all eight app/onboarding/security RPCs present, zero anon execute grants, eight authenticated execute grants, and zero direct table-level write grants. The replay-only schema was removed after verification.
- Supabase security advisor currently reports four INFO RLS-enabled/no-policy findings in the pre-existing `public` schema only (`audit_logs`, `fraud_reviews`, `platform_config`, `user_roles`). The advisor output did not enumerate the isolated non-public candidate schema; candidate policy coverage was checked directly instead.
- Performance advisor: no unindexed foreign keys remain in the candidate schema. Unused-index notices are expected because the candidate contains no workload data yet. The SQL security-contract test script completed with `rebuild_v2_security_contract: PASS`.
- Privileged RPCs were checked to deny callers without an authenticated admin/financial identity; immutable-event trigger behavior was checked.

## Not yet completed

- Complete role-matrix RLS tests for financial and admin roles. Tester self/other isolation, developer app lifecycle, onboarding restrictions, support ticket ownership/staff access, internal-note visibility, and notification read isolation were tested with synthetic Auth users; all synthetic users and test data were cleaned up. Active-session and security-activity RPCs were checked for self-only reads. FixLab currently has no Storage buckets, so Storage object-path tests remain outstanding.
- Full app/API contract mapping for every frontend workflow and RPC. The first-pass route/data map is documented; remaining mismatches include points ledger, assignment fields, check-in evidence, support writes, notifications, onboarding, active sessions, security history, and leaderboard privacy.
- Storage bucket policies and upload/download path authorization. Production inventory confirmed five existing buckets and zero objects; no bucket or object was changed.
- Migration replay in a clean disposable Supabase project. The existing inactive rebuild project could not be restored because the organization reached its free active-project limit.
- Verified production backup and restore rehearsal.
- Data migration plan for the two existing production Auth users and existing Storage buckets.
- Production cutover. The production project has not been modified.

## Safety boundary

Do not move these scripts into the active migration directory, apply them to production, drop the existing `public` schema, delete migration history, or alter Auth/Storage until:
1. a restorable backup is verified,
2. app compatibility and role-isolation tests pass,
3. the data-preservation mapping is approved, and
4. a rollback plan is rehearsed.
