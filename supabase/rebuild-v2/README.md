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

## Apply and test order

This folder is deliberately separate from `supabase/migrations`. Do not move it into the active migration path or apply it to Production until the validation gates in [the rebuild plan](../../docs/database-rebuild-v2.md) pass.

Apply all 18 scripts in numeric order, from `001_schema.sql` through `018_verify_submission_evidence_metadata.sql`.

Run the phase-one security contract immediately after scripts 001–006:
- `tests/security_contract.sql` — intentionally checks the 43-table / five-bucket foundation at that checkpoint. It must not be run as a final-state assertion.

After all 18 scripts, run:
- `tests/final_state_contract.sql` — checks the final 47-table / seven-bucket candidate and the Financial role.
- `tests/003_app_lifecycle_contract.sql`
- `tests/004_profile_contract.sql`
- `tests/005_developer_lifecycle_contract.sql`
- `tests/006_test_media_assets_contract.sql`
- `tests/007_tester_workflow_contract.sql`
- `tests/008_developer_feedback_privacy_contract.sql`
- `tests/009_wallet_idempotency_contract.sql` — verifies exact retries return the original ledger entry and reused keys with changed operation, reference, reason, or financial actor are rejected without a second balance change.

The tester workflow contract runs after script 018 because it exercises the scheduled-start behavior introduced by 017 and the final evidence metadata verification introduced by 018. All contract tests use rolled-back transactions; the final-state contract is read-only.

The dedicated [Rebuild V2 CI workflow](../../.github/workflows/rebuild-v2-tests.yml) starts a disposable local Supabase stack, applies the 18 candidate scripts in order, runs the phase-one contract at the 001–006 checkpoint, and then runs the final-state/workflow contracts. It never connects to a hosted project.

The developer lifecycle contract validates app submission and admin-only approval, test creation/submission and admin-only approval, test content authoring, cohort lifecycle, minimum tester readiness, private APK registration/upload verification/participant download, tester join, and audit-event creation. The tester workflow contract covers ownership isolation, idempotency, capacity enforcement, schedule-window enforcement, evidence ownership/metadata verification, and rollback cleanup.

## Current validation boundary

TestDZ-FixLab currently contains the candidate schema with 47 tables and seven Storage buckets. The candidate scripts through 018 have been applied there and the later workflow/media/feedback paths have been exercised with rollback-based contracts. This is not yet proof that all 18 scripts can build a completely empty Supabase project from scratch: clean-stack replay and automated CI coverage are still required.

Never use Production as a replay target. Production has not been changed by this candidate work.
