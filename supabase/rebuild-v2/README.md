# Rebuild v2 candidate scripts

These scripts describe the isolated TestDZ rebuild candidate. They are a candidate sequence, not active production migrations.

## Ordered candidate scripts

- `001_schema.sql`: candidate tables, indexes, and RLS enablement/force.
- `002_security.sql`: private security functions, triggers, policies, and grants.
- `003_app_lifecycle.sql`: developer app quota/create/update/archive/restore RPCs with invoker wrappers and private definer implementations.
- `004_identity_sessions.sql`: validated onboarding plus self-only active-session and security-activity RPCs.
- `005_support_notifications.sql`: ticket creation/replies, attachment metadata registration, and owner-scoped notification read-state RPCs.
- `006_storage_policies.sql`: five initial bucket definitions, owner/participant upload and read policies, and private evidence access helpers.
- `007_tester_workflow.sql`: tester discovery, joining, assignments, check-ins, feedback, submissions, and private evidence workflow.
- `008_developer_lifecycle.sql`: app submission/admin review, test create/update/submission/admin review, and developer cohort creation RPCs.
- `009_lock_app_edits_during_review.sql`: blocks developer edits while an app is pending review or published; edits are limited to draft/rejected states.
- `010_guard_test_cohort_capacity.sql`: requires a published parent app and cohort capacity at least equal to the test's minimum tester target.
- `011_test_content_authoring.sql`: owner-checked atomic save of ordered test steps and requirements, editable only while the test is draft/failed/cancelled.
- `012_cohort_management.sql`: owner-only forming-cohort edits and audited lifecycle transitions; pending assignments are withdrawn on safe cancellation.
- `013_private_test_builds.sql`: private APK bucket, owner-registered build metadata, upload verification, tester-participant read policy, and APK-test review gate.
- `014_harden_test_build_storage_helper.sql`: narrows Storage upload authorization to the exact pending metadata path registered by the owning developer.
- `015_private_test_media_assets.sql`: private developer-supplied images, videos and documents with owner registration, MIME/size checks, verified upload finalization, and assigned-tester read access.
- `016_private_developer_feedback.sql`: owner-scoped developer feedback RPCs, sanitized tester labels, and removal of developer access to raw assignments, check-ins and feedback.
- `017_enforce_assignment_schedule.sql`: enforces test/cohort schedule windows when starting an assignment while preserving safe idempotent retries.
- `018_verify_submission_evidence_metadata.sql`: verifies evidence object ownership, MIME type, and size before final submission completion.
- `019_notification_recipient_roles.sql`: restores tester/developer notification feed separation, role-aware reads, and role-scoped read-state RPCs.
- `020_notification_event_producers.sql`: adds a private server-owned event enqueue helper, idempotency linkage, and a service-role-only batch dispatcher with `SKIP LOCKED`, retry backoff, and terminal failure after five attempts.
- `021_feedback_notification_producers.sql`: notifies the owning developer when tester feedback is submitted, and notifies the tester when the developer changes review status or replies; event payloads contain identifiers and status only, never feedback/message bodies.
- `022_admin_role_request_management.sql`: exposes an Admin-only pending Developer role-request queue and reason-required, self-review-protected decisions.
- `023_admin_role_grants.sql`: exposes a reason-required Admin-only role grant wrapper; prevents self-grants and Admin-role grants, and records one audit event per newly granted role.



## Notification outbox worker

The candidate Edge Function source is `supabase/functions/dispatch-notifications/index.ts`. It accepts only server-to-server POST requests carrying the `x-dispatch-secret` header, then invokes the service-role-only `rebuild_v2.process_notification_outbox` RPC. Its configuration disables platform JWT verification only because the function performs its own shared-secret check; never expose the secret to the browser.

Before enabling it in any hosted environment, deploy the Edge Function only after the V2 schema is approved and applied to the intended project, set `NOTIFICATION_DISPATCH_SECRET` as an Edge Function secret, verify the standard server-side Supabase credentials are available, and configure a scheduled invocation using Supabase Vault/pg_cron. The repository contains the worker source only; no Edge Function or cron job has been deployed or scheduled in the hosted TestDZ or FixLab projects.

## Apply and test order

This folder is deliberately separate from `supabase/migrations`. Do not move it into the active migration path or apply it to Production until the remaining compatibility, history, backup, and rollback gates pass.

Apply all 23 scripts in numeric order, from `001_schema.sql` through `023_admin_role_grants.sql`.

Run the phase-one security contract immediately after scripts 001–006:
- `tests/security_contract.sql` — intentionally checks the 43-table / five-bucket foundation at that checkpoint. It must not be run as a final-state assertion.

After all 23 scripts, run:
- `tests/catalog_fingerprint.sql` — read-only catalog fingerprint for columns, constraints, indexes, function definitions, effective table/schema/function grants, RLS enabled/forced flags, policies, triggers, and Storage buckets; compare its output on the clean replay and FixLab.
- `tests/catalog_difference_details.sql` — read-only drill-down of constraint, policy, and Storage bucket differences, including legacy Storage policy names. Neither diagnostic automatically proves parity; review all output and documented exclusions manually.
- `tests/final_state_contract.sql` — checks the final 47-table / seven-bucket candidate and the Financial role.
- `tests/003_app_lifecycle_contract.sql`
- `tests/004_profile_contract.sql`
- `tests/005_developer_lifecycle_contract.sql`
- `tests/006_test_media_assets_contract.sql` — verifies private media upload/access boundaries and the uploader/target audit event.
- `tests/007_tester_workflow_contract.sql` — verifies final submission evidence uses the V2 `v2/` namespace and the V2 helper rejects the legacy unprefixed path.
- `tests/008_developer_feedback_privacy_contract.sql`
- `tests/009_wallet_idempotency_contract.sql` — verifies exact retries return the original ledger entry, changed operation/reference/reason/actor are rejected, and one successful wallet posting creates exactly one actor/request-linked audit event.
- `tests/010_security_definer_boundary_contract.sql` — verifies the V2 schema exposure boundary, restricted schema creation, and SECURITY DEFINER ownership/search-path requirements.
- `tests/011_notification_recipient_roles_contract.sql` — verifies tester/developer feed isolation and role-scoped read-one/read-all operations.
- `tests/012_notification_outbox_retry_contract.sql` — verifies authenticated callers cannot drain the outbox, retry attempts record errors and backoff, and the fifth failure moves an undeliverable event to terminal `failed` without creating an inbox row.
- `tests/013_wallet_role_boundary_contract.sql` — verifies Tester and Support cannot post wallet entries, Financial and Admin can post audited entries, authenticated users cannot directly mutate wallet or role tables, Support cannot read another user's financial records, Financial/Admin can inspect the expected financial records, and private role-request/review/grant helpers are not executable by client roles.
- `tests/014_onboarding_developer_approval_contract.sql` — verifies onboarding can establish only the baseline Tester role, a Developer selection creates a pending role request instead of granting Developer access, repeated onboarding does not duplicate requests or revoke approved roles, and privileged roles cannot be self-selected.
- `tests/015_admin_role_request_management_contract.sql` — verifies the Admin-only Developer request queue, reason-required decisions, non-Admin denial, and audited approval.
- `tests/016_admin_role_grant_contract.sql` — verifies Admin-only role grants, no self-grant or Admin-role grant, no direct role-table writes, reason validation, actor attribution, and idempotent duplicate grants.
- `tests/017_support_ticket_role_boundary_contract.sql` — verifies Support can read the ticket queue and conversation records, cannot directly mutate ticket/conversation/attachment tables, cannot read another user's financial records, and that V2 support attachments use a namespaced path with owner-only upload/read.
- `tests/018_audit_event_append_only_contract.sql` — verifies only Admin can read audit events, authenticated clients cannot write them directly, and database triggers reject UPDATE/DELETE even when exercised by the local migration owner.
- `tests/019_app_icon_storage_boundary_contract.sql` — verifies V2 app icons use the `v2/{user_id}/{app_id}/...` path, require app ownership, and cannot be written by a different authenticated user.

The tester workflow contract runs after script 018 because it exercises the scheduled-start behavior introduced by 017 and the final evidence metadata verification introduced by 018. The notification recipient-role contract runs after script 019. The tester workflow contract also asserts that test enrollment and final submission enqueue developer events, tester feedback notifies the owning developer, and developer review/replies notify the tester; scripts 020 and 021 supply the private enqueue helper and lifecycle producers. All contract tests use rolled-back transactions; the final-state contract is read-only.

The dedicated [Rebuild V2 CI workflow](../../.github/workflows/rebuild-v2-tests.yml) starts a disposable local Supabase stack, applies the 23 candidate scripts in order, runs the phase-one contract at the 001–006 checkpoint, and then runs the twenty post-phase SQL diagnostics/contracts. It never connects to a hosted project.

## Validation completed (2026-11-16)

- GitHub Actions run [#8](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43944382982), commit `665ea461430c958132108c2310d5c11a59469d6c`, completed successfully.
- Historical run #8 applied the then-current 18-script candidate to a disposable empty local Supabase stack.
- The current PR #49 validation run [#44138645785](https://github.com/laidktif67-sketch/TestDZ/actions/runs/44138645785), commit `f86f6de87155d1a576b572263cc76e2fdd95ced0`, passed the 19-script replay and all 11 contracts (phase-one security plus ten post-phase contracts).
- The wallet idempotency contract explicitly returned `rebuild_v2_wallet_idempotency_contract: PASS`.
- Contract fixtures were rolled back; the final-state contract's cleanup check reported zero remaining app, profile, and auth-user fixtures.
- The disposable local Supabase stack stopped successfully.
- Read-only FixLab inventory confirmed 47 candidate tables, RLS and FORCE RLS on all 47, 439 columns, 297 constraints, 157 indexes, 48 candidate policies, 96 candidate functions (39 exposed-schema and 57 private-schema functions), six candidate triggers, seven Storage buckets, and 18 Storage object policies.
- FixLab's current hosted migration history still contains 21 records. It has not been repaired or reset.

## Current clean replay snapshot (2026-11-18)

GitHub Actions run [#44293133432](https://github.com/laidktif67-sketch/TestDZ/actions/runs/44293133432) on the current 23-script candidate completed successfully. The read-only local fingerprint reported:

- 440 columns, 297 constraints, 159 indexes, 97 functions (excluding the documented date-delta functions), 66 V2 policies, 47 RLS/ FORCE RLS table flags, 863 effective table/schema/function grants, and 7 application triggers.
- Six buckets in the fingerprint (excluding the legacy `app-icons` bucket); the detailed report lists all seven buckets.
- The local replay retains `app-icons` at 512000 bytes from the earlier migration because candidate script 006 requests 524288 bytes but uses `ON CONFLICT DO NOTHING`. This is an explicit configuration delta to verify against FixLab, not a reason to overwrite an existing bucket automatically.
- Twelve legacy Storage object policies coexist with V2 policies in the local replay: `app_icons_owner_delete`, `app_icons_owner_insert`, `app_icons_owner_update`, `app_icons_public_read`, `avatars_owner_delete`, `avatars_owner_insert`, `avatars_owner_select`, `avatars_owner_update`, `report_evidence_insert_active_assignment`, `report_evidence_select_authorized_participants`, `support_attachments_insert_participants`, and `support_attachments_select_participants`.

**Storage compatibility note:** permissive Storage policies combine with OR semantics. V2 app icons, support attachments, and test-evidence uploads now use a dedicated `v2/` path prefix. The legacy app-icon policies require the first folder to equal the user ID; legacy support/evidence policies require a UUID in the first folder. Those policies therefore do not match V2-prefixed paths, while V2 helpers validate app ownership, ticket/requester role, assignment state, and participant access. Contracts 019, 017, and 007 verify the V2 path boundaries. Legacy unprefixed paths remain available for the legacy workflow; do not remove legacy policies until that workflow is formally retired. The current Report Problem page is still a non-submitting UI placeholder; do not treat report-evidence upload as an enabled V2 workflow until a guarded metadata-registration RPC and UI integration are implemented. A read-only FixLab inventory found zero V2 apps with app-icon URLs, zero V2 submission/report/support attachment metadata rows, and zero objects in the `app-icons`, `test-evidence`, and `support-attachments` buckets, so no existing V2 object paths require migration. No hosted or Production policy was changed.

## Remaining validation gates

1. **Exact live-to-clean comparison:** compare the complete catalog definitions (columns, constraints, indexes, function bodies/security attributes, policies, grants, triggers, and Storage configuration) between FixLab and a clean replay. The successful CI replay proves the scripts build cleanly and pass contracts; it does not by itself prove byte-for-byte catalog equivalence with the hosted FixLab schema.
2. **Legacy-schema compatibility decision:** FixLab also contains 24 tables in the `public` schema. The frontend selects the legacy `public` schema when `VITE_TESTER_WORKFLOW_V2_ENABLED` is false or unset, and selects `rebuild_v2` only when enabled. Decide whether the public schema remains part of the supported application baseline or whether all active application paths will be cut over to V2 before excluding it from a new baseline.
3. **Frontend compatibility:** complete the route/API-to-SQL mapping, including roles, tester rewards, referrals, reports, leaderboard privacy, and admin workflows.
4. **Security follow-up:** the current FixLab security advisor reports four INFO findings for legacy public tables with RLS enabled but no policies: `public.audit_logs`, `public.fraud_reviews`, `public.platform_config`, and `public.user_roles`. Their effective access must be reviewed before any legacy schema is retained or retired.
5. **Backup and restore:** verify a restorable Production backup and rehearse restoration before any production migration.
6. **Data preservation:** approve explicit mappings for existing Auth users, Storage buckets/objects, and any data that must be retained.
7. **Cutover and rollback:** prepare a tested rollback plan and obtain explicit approval before any Production action.

## Migration-history strategy

The approved direction is to preserve the existing candidate schema and data, archive the old migration files in Git rather than permanently deleting them, and establish a new baseline/history only after clean replay and legacy-schema scope are resolved. The 21 existing FixLab migration-history records must not be removed until the replacement baseline is verified and the exact history operation is reviewed. Do not change Production migration history.

## Safety boundary

- Do not apply candidate scripts to Production.
- Do not drop or reset the existing FixLab candidate schema or its data as part of this validation.
- Do not delete Auth users or Storage objects.
- Do not run `supabase db pull` against FixLab as a shortcut; CLI v3 defaults and hosted migration-history behavior must be considered before any hosted command.
- Do not change `supabase/config.toml` project targeting or run a hosted CLI command until the target project ref is explicitly verified.
- No Production cutover is authorized by this document.
