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
- `022_admin_role_request_management.sql`: Admin-only pending role-request queue and reason-required approval/rejection with self-review prevention.
- `023_admin_role_grants.sql`: audited Admin role grants; prevents self-grants and client-side Admin-role assignment.
- `024_audited_support_ticket_workflow.sql`: reason-required Support/Admin ticket transitions and immutable message/status/priority event history.
- `025_require_report_attachment_metadata.sql`: blocks incident-report evidence uploads until trusted attachment metadata has been registered, while preserving the existing four-segment assignment-submission evidence path.
- `026_align_report_evidence_read_access.sql`: aligns report-evidence object reads with reporter/Support/Admin report visibility while preserving assignment-submission evidence reads.
- `027_enforce_report_attachment_metadata_integrity.sql`: enforces canonical non-null report-evidence object paths.
- `028_restrict_support_attachment_reads_to_public_messages.sql`: restricts attachment metadata and Storage reads to public ticket messages for requesters and staff.
- `029_six_step_test_config.sql`: validates the six-step configuration allowlist and saves it atomically with a test draft; raw tester email lists remain client-local.
- `030_developer_test_monitoring_summary.sql`: owner-checked aggregate-only monitoring; daily activity is suppressed unless at least three distinct testers contributed.
- `031_role_explicit_support_ticket_creation.sql`: role-explicit support ticket creation for dual-role Tester/Developer accounts.
- `032_developer_test_invitations.sql`: email-bound, hashed-token invitations with owner-scoped listing, revocation, expiry and atomic Tester redemption.
- `033_support_tester_data_boundary.sql`: removes Support access to raw tester assignments, check-ins, and feedback while preserving Admin oversight.
- `034_tester_feedback_reply_access.sql`: exposes developer-authored replies only to the authenticated owner of the feedback.
- `035_sync_six_step_config_on_test_edit.sql`: keeps the persisted six-step target tester count and tester instructions synchronized when the developer edits the corresponding test fields.

Migrations 022–029 are now included as a curated candidate sequence after separate security and contract review. Migrations 030–032 follow them: aggregate monitoring (030), role-explicit Support ticket creation (031), then email-bound developer invitations (032).



## Developer invitation function\n\nThe candidate Edge Function source is `supabase/functions/developer-invitations/index.ts`. It verifies the caller with Supabase Auth, derives a 256-bit token using the server-only `DEVELOPER_INVITATION_TOKEN_SECRET`, stores only its SHA-256 hash through the V2 RPCs, and returns the raw token only in the create response. The first release is copy-link only and explicitly reports `Link ready — not emailed`. Configure the secret only in a hosted Edge Function after separate approval; no secret or function deployment is included here.\n\n## Notification outbox worker

The candidate Edge Function source is `supabase/functions/dispatch-notifications/index.ts`. It accepts only server-to-server POST requests carrying the `x-dispatch-secret` header, then invokes the service-role-only `rebuild_v2.process_notification_outbox` RPC. Its configuration disables platform JWT verification only because the function performs its own shared-secret check; never expose the secret to the browser.

Before enabling it in any hosted environment, deploy the Edge Function only after the V2 schema is approved and applied to the intended project, set `NOTIFICATION_DISPATCH_SECRET` as an Edge Function secret, verify the standard server-side Supabase credentials are available, and configure a scheduled invocation using Supabase Vault/pg_cron. The repository contains the worker source only; no Edge Function or cron job has been deployed or scheduled in the hosted TestDZ or FixLab projects.

## Apply and test order

This folder is deliberately separate from `supabase/migrations`. Do not move it into the active migration path or apply it to Production until the remaining compatibility, history, backup, and rollback gates pass.

Apply all 35 selected scripts in numeric order: `001_schema.sql` through `035_sync_six_step_config_on_test_edit.sql`. This is still a candidate-only sequence, separate from `supabase/migrations`.

Run the phase-one security contract immediately after scripts 001–006:
- `tests/security_contract.sql` — intentionally checks the 43-table / five-bucket foundation at that checkpoint. It must not be run as a final-state assertion.

After all 35 selected scripts, run:
- `tests/final_state_contract.sql` — checks the final 48-table / seven-bucket candidate, including the forced-RLS invitation table and the Financial role.
- `tests/003_app_lifecycle_contract.sql`
- `tests/004_profile_contract.sql`
- `tests/005_developer_lifecycle_contract.sql`
- `tests/006_test_media_assets_contract.sql`
- `tests/030_apk_build_storage_contract.sql` — verifies private APK build ownership, upload verification, and assigned-tester read boundaries.
- `tests/030_cohort_assignment_delete_safety_contract.sql` — verifies cohort deletion cannot cascade into active or historical assignment records.
- `tests/031_developer_test_edit_contract.sql` — verifies owner-only test editing, validation, audit behavior, and synchronization of six-step configuration fields.
- `tests/022_reports_disputes_fail_closed_contract.sql` — verifies report/dispute access remains role-scoped and fails closed.
- `tests/007_tester_workflow_contract.sql`
- `tests/008_developer_feedback_privacy_contract.sql`
- `tests/009_wallet_idempotency_contract.sql` — verifies exact retries return the original ledger entry and reused keys with changed operation, reference, reason, or financial actor are rejected without a second balance change.
- `tests/010_security_definer_boundary_contract.sql` — verifies the V2 schema exposure boundary, restricted schema creation, and SECURITY DEFINER ownership/search-path requirements.
- `tests/011_notification_recipient_roles_contract.sql` — verifies tester/developer feed isolation and role-scoped read-one/read-all operations.
- `tests/015_admin_role_request_management_contract.sql` — verifies Admin-only request review, reason requirements, and audited approval.
- `tests/016_admin_role_grant_contract.sql` — verifies the guarded role-grant boundary, no self-grant/Admin grant, and idempotent audit behavior.
- `tests/020_support_ticket_audited_workflow_contract.sql` — verifies role-bound status transitions, immutable events, and body-free staff audit metadata.
- `tests/024_report_evidence_metadata_contract.sql` — verifies pre-registered report evidence uploads and reporter/Support/Admin read boundaries.
- `tests/025_six_step_test_config_contract.sql` — verifies atomic config persistence, target-count consistency, no raw email list, and role authorization.
- `tests/029_support_attachment_privacy_contract.sql` — verifies requester/Support/Admin can read public-message attachments but not internal-note attachments; unrelated users see neither.
- `tests/026_developer_test_monitoring_privacy_contract.sql` — verifies owner-only aggregate monitoring and minimum distinct-tester suppression.
- `tests/027_role_explicit_support_ticket_creation_contract.sql` — verifies dual-role workspace selection and rejects role spoofing.
- `tests/028_developer_test_invitations_contract.sql` — verifies hashed-token storage, email-bound redemption, idempotency, revocation and direct-table denial.

The tester workflow contract runs after script 018 because it exercises the scheduled-start behavior introduced by 017 and the final evidence metadata verification introduced by 018. The notification recipient-role contract runs after script 019. The tester workflow contract also asserts that test enrollment and final submission enqueue developer events, tester feedback notifies the owning developer, and developer review/replies notify the tester; scripts 020 and 021 supply the private enqueue helper and lifecycle producers. All contract tests use rolled-back transactions; the final-state contract is read-only.

The dedicated [Rebuild V2 CI workflow](../../.github/workflows/rebuild-v2-tests.yml) starts a disposable local Supabase stack, applies the 35 selected candidate scripts in order, runs the phase-one contract at the 001–006 checkpoint, and then runs the 23 post-phase contracts, including the final-state contract. It never connects to a hosted project.

## Validation completed (2026-11-16)

- GitHub Actions run [#8](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43944382982), commit `665ea461430c958132108c2310d5c11a59469d6c`, completed successfully.
- Historical run #8 applied the then-current 18-script candidate to a disposable empty local Supabase stack.
- The current PR #49 validation run [#44138645785](https://github.com/laidktif67-sketch/TestDZ/actions/runs/44138645785), commit `f86f6de87155d1a576b572263cc76e2fdd95ced0`, passed the 19-script replay and all 11 contracts (phase-one security plus ten post-phase contracts).
- The wallet idempotency contract explicitly returned `rebuild_v2_wallet_idempotency_contract: PASS`.
- Contract fixtures were rolled back; the final-state contract's cleanup check reported zero remaining app, profile, and auth-user fixtures.
- The disposable local Supabase stack stopped successfully.
- Read-only FixLab inventory confirmed 47 candidate tables, RLS and FORCE RLS on all 47, 439 columns, 297 constraints, 157 indexes, 48 candidate policies, 96 candidate functions (39 exposed-schema and 57 private-schema functions), six candidate triggers, seven Storage buckets, and 18 Storage object policies.
- FixLab's current hosted migration history still contains 21 records. It has not been repaired or reset.

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

## Assignment review lifecycle addendum (036–043)

The current candidate extends the original 035-script sequence with the assignment submission review lifecycle, medical exception and feedback-quality review, 14-day completion gates, rejected-feedback revision, and server-only review-deadline processing.

- `036_assignment_review_lifecycle.sql`: submission attempts, developer review decisions, immutable review history, and fail-closed completion.
- `037_medical_exception_and_feedback_quality.sql`: private medical evidence, Admin-only medical/feedback-quality decisions, audit events, and notifications.
- `038_enforce_14_day_assignment_completion.sql`: 14 consecutive-day completion prerequisites and finalization guards.
- `039_feedback_quality_revision.sql`: tester revision of rejected feedback without replacing its identity.
- `040_assignment_review_deadline_processor.sql`: 48-hour reminder enqueue and guarded 72-hour auto-approval processor.
- `041_wait_for_delivered_review_reminder.sql`: starts the 24-hour auto-approval wait only after the reminder outbox event is marked delivered and an in-app notification is created.
- `042_retry_failed_review_reminder_delivery.sql`: adds a bounded three-retry recovery counter for terminal reminder delivery failures. Each retry creates a new outbox event while retaining the failed event for audit; auto-approval remains blocked until a reminder is actually delivered.
- `043_block_auto_approval_on_open_assignment_disputes.sql`: prevents system auto-approval while an assignment-linked report is open/under review or its linked dispute is opened/under review/escalated. Human developer review remains a separate explicit decision path.

The current CI workflow replays **43** numbered candidate SQL scripts in a disposable local Supabase stack. The deadline contract verifies that enqueueing alone does not start the wait, dispatch delivery does, an insufficient 24-hour interval blocks approval, missing completion prerequisites continue to block approval, and an unresolved assignment-linked report/dispute blocks automatic approval. The same contract now forces a terminal outbox failure and verifies that a replacement event is queued, the retry counter increments, and the original failure remains recorded. The older 35-script and 40-script counts elsewhere in this historical README describe earlier snapshots and are superseded by this addendum and the current workflow.
