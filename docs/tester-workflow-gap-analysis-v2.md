# Tester Workflow Gap Analysis — TestDZ V2

Branch: `rebuild/testdz-v2`  
Baseline reviewed: `db53ce0538d1dac6f158a6e745fff1a0c87fb135`  
Review type: static source and candidate-schema inspection only. No database writes or production changes.

## Executive result

The tester UI has most of the major screens, but the core tester workflow is not end-to-end functional against the V2 candidate schema yet. The current frontend Supabase client uses the default `public` schema. The candidate schema is `rebuild_v2`, and its current RPC set does not yet include tester assignment, check-in, feedback submission, or report submission operations.

The V2 security model intentionally withholds direct authenticated table writes. Therefore, wiring existing forms directly to table inserts/updates would be incorrect and would bypass the intended RPC boundary.

## Existing tester routes

The router currently exposes these tester-facing routes:

- `/tester-dashboard`
- `/discover-tests`
- `/tests/:id`
- `/my-tests`
- `/assignments/:id`
- `/assignments/:id/progress`
- `/assignments/:id/submit`
- `/assignments/:id/summary`
- `/assignments/:id/reward`
- `/check-in-history`
- `/activity-history`
- `/feedback-history`
- `/leaderboard`
- `/wallet-rewards`
- `/withdrawal-request`
- `/withdrawal-status`
- support, notifications, profile, security, privacy, language and referral routes.

## Confirmed integration gaps

1. `apps/web/src/lib/supabase.ts` creates a Supabase client without selecting `rebuild_v2`; calls currently resolve against `public`.
2. `DiscoverTestsPage` reads `tests`, `wallets`, `assignments`, `notifications`, and profile data from the legacy default schema. No V2 RPC exists to apply eligibility checks and atomically join/assign a tester.
3. `AssignmentDetailsPage` reads assignment/test/app details from the default schema.
4. `AssignmentSubmissionPage` reads assignments, check-ins, and feedback from the default schema. Its submit action explicitly reports that final submission is not connected and sends no report or files.
5. `MyTestsPage` reads roles, profile, wallets, assignments, feedback, and notifications from the default schema.
6. `NotificationsCenterPage` performs direct table updates for read state. V2 provides `mark_notification_read` and `mark_all_notifications_read`; the UI should use those RPCs once the V2 client is configured.
7. `SubmitFeedbackPage` and `ReportProblemPage` contain form UI, but this review did not find a database submission operation in either page.
8. `WithdrawalRequestPage` explicitly identifies itself as a temporary preview and does not persist a real request. Withdrawal/payment implementation remains intentionally deferred.

## V2 schema support already present

Candidate schema `001_schema.sql` includes the core tables:

- `tests`, `test_steps`, `test_requirements`, `test_media`
- `cohorts`, `cohort_tests`, `assignments`, `checkins`
- `feedback`, `reports`, `report_attachments`
- `wallets`, `wallet_ledger`, `notifications`

Current candidate RPCs cover app lifecycle, onboarding/session/security, support, attachments for support, and notification read state. There are currently no public V2 RPCs for tester discovery eligibility, assignment enrollment/withdrawal, check-in, feedback submission, or final report submission.

## Required implementation order

### Phase A — Tester workflow backend contract (candidate only)

Design and test authenticated RPCs before connecting the UI:

1. Read-only discovery/eligibility operation: return only published/recruiting tests, test requirements and remaining cohort capacity; never trust client-supplied eligibility or points.
2. Atomic join operation: validate auth identity, tester role, test state/date, cohort availability, eligibility, duplicate assignment and capacity; create the assignment atomically.
3. Assignment start/progress operation: validate ownership and allowed state transitions.
4. Check-in operation: enforce assignment ownership/state, server date, one check-in per assignment/day and bounded note/evidence metadata.
5. Feedback submission operation: enforce ownership, active/completed state rules, field limits and one feedback per assignment; set review state server-side.
6. Final report submission operation: validate required fields and evidence metadata, transition assignment once, and prevent duplicate completion/reward.
7. Any reward posting must be server-side, idempotent, tied to an accepted/completed workflow event, and must not accept an amount from the browser. Actual cash withdrawals remain out of scope.

All implementation functions should live in `rebuild_v2_private`, with narrow authenticated wrappers in `rebuild_v2`, fixed search paths, explicit grants, and tests for owner/non-owner, wrong role, duplicate calls, invalid transitions, and race conditions.

### Phase B — Frontend integration

1. Add an explicit V2 Supabase client/schema configuration without silently changing the legacy client used by unmigrated pages.
2. Move one workflow slice at a time to V2 APIs: discover → join → details → progress/check-in → submit → history.
3. Replace direct notification read updates with existing V2 RPCs.
4. Remove misleading success states; show clear unavailable/error states until each backend operation is live.
5. Preserve current routes and UI behavior except where the backend contract requires a safe correction.

### Phase C — Verification

- Run typecheck, lint and production build locally/CI.
- Run candidate SQL contract tests and isolated workflow integration tests in FixLab.
- Verify RLS, RPC grants, idempotency, race conditions and cross-user denial.
- Keep Production untouched until backup/restore rehearsal, complete compatibility review and explicit cutover approval.

## Guardrails

- Do not apply candidate SQL to Production.
- Do not move candidate SQL into active migrations until approved.
- Do not write balances, points, assignment status, quality status, or review metadata directly from the browser.
- Do not implement cash withdrawal/payment in this phase.
- Do not delete or rewrite existing production data.
- Keep PR #18 unchanged and do not merge it as part of this work.

## Status

This document records a static gap analysis only. No application source, database schema, migration, production data, or PR state was changed by the review.
