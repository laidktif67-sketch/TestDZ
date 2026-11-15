# TestDZ rebuild v2 — application compatibility audit (first pass)

Date: 2026-11-15  
Branch: `rebuild/testdz-v2`  
Audited application ref: current branch head at time of review  
Candidate schema: `rebuild_v2` / `rebuild_v2_private` in TestDZ-FixLab

## Scope and safety

This is a source-to-schema compatibility review. It does not modify production, Auth users, Storage objects, active migrations, or the candidate database. The candidate SQL remains outside `supabase/migrations`. PR #18 remains open, draft, and unmerged.

This is a first-pass audit of application modules and tester workflows, not a claim that every admin or developer workflow has been exhaustively mapped.

## Confirmed compatibility blockers

| Application contract | Existing application usage | Candidate v2 state | Required resolution |
|---|---|---|---|
| Points ledger | Multiple tester pages query `points_ledger` | Candidate has `wallet_ledger`; no `points_ledger` | Decide and document a single canonical ledger contract. Prefer adapting app queries to the immutable ledger only after checking expected columns/semantics; do not create a writable compatibility table. |
| Assignment dates/rewards | Pages query `assignments.start_date` and `assignments.points_awarded` | Candidate `assignments` has `assigned_at`, `started_at`, `completed_at`, `due_at`; no `start_date` or `points_awarded` | Define whether start_date is a display alias for started_at/assigned_at, and derive awarded points from ledger entries or a server-owned reward snapshot. Never accept client-supplied reward totals. |
| Check-in evidence | Active assignment UI queries `checkins.evidence_url` | Candidate has `evidence_path` | Reconcile URL/path contract; prefer private Storage path and signed URL generation, not public evidence URLs. |
| App lifecycle RPCs | `get_app_limit`, `create_app`, `update_app`, `archive_app`, `restore_app` are called by `features/apps/apps-api.ts` | No matching RPCs in candidate schemas | Implement validated, role-checked server-side RPCs or deliberately refactor the app API before cutover. App create/update/archive must not become direct unrestricted writes. |
| Onboarding | `complete_onboarding` called by `features/profiles/profiles-api.ts` | No matching RPC in candidate | Add a server-side onboarding contract that only permits safe profile fields and the approved default tester role; never accept privileged roles from browser input. |
| Active sessions | Tester Active Sessions calls `get_my_active_sessions` | No matching RPC in candidate | Determine required session data and implement a self-only, privacy-preserving function or remove the UI dependency with explicit product approval. |
| Support ticket creation | Support Center directly inserts into `support_tickets` | Candidate revokes all direct table writes; no ticket-create RPC | Add a constrained authenticated RPC (or safe RLS insert policy with immutable owner/role checks) and update client contract. |
| Support conversation replies | Ticket Details directly inserts into `support_ticket_messages` | Candidate revokes all direct table writes; no reply RPC | Add a ticket-participant-checked RPC; enforce sender = auth.uid(), closed-ticket rules, and customer inability to create internal notes. |
| Support attachment metadata | Ticket Details directly inserts into `support_ticket_attachments` | Candidate revokes all direct table writes; no attachment RPC | Add metadata RPC/policy tied to an existing message, ticket participant, uploader, validated path, size and MIME type. |
| Notification read state | Notifications Center updates `notifications.read_at` directly | Candidate revokes all direct table writes | Add a self-only mark-read RPC or a narrowly scoped update policy with both USING and WITH CHECK. |
| Storage | App uses `avatars`, `app-icons`, `support-attachments`; other screens reference test evidence/media | Candidate SQL has no bucket/policy provisioning plan yet | Inventory production bucket names/configuration and define private/public access and path policies per feature before cutover. |

## Confirmed field/table mismatches

- `points_ledger` is referenced by Wallet & Rewards, Feedback History, Check-in History, Activity History, Notifications Center, Privacy/Data export, completion/reward screens, leaderboard, and active assignment progress. Candidate has `wallet_ledger` with `wallet_type`, `amount`, `entry_type`, `reference_type`, `reference_id`, `idempotency_key`, `actor_id`, `reason`, and `created_at`.
- `assignments.start_date` and `assignments.points_awarded` are queried by assignment details/submission, activity, completion summary/reward, privacy export, and active progress. Candidate has no such columns.
- `checkins.evidence_url` is queried by Active Assignment Progress; candidate has `evidence_path`.
- Privacy export requests `profiles.subscription_tier`; candidate profiles does not contain that field. The canonical source should likely be `subscriptions` joined to `plans`, but UI/export semantics must be checked before refactoring.
- UI identity role allow-list currently contains `tester`, `developer`, `admin`, `support`; candidate additionally supports `financial`. Staff-role visibility and routing need a deliberate UI contract. Financial access must not be granted through public onboarding or user-editable metadata.
- `apps-api.ts` selects the app fields already present in candidate `apps`; app CRUD lifecycle still depends on missing RPCs.
- Support UI reads candidate-compatible columns for tickets/messages/attachments, but direct write behavior is incompatible with candidate privileges.

## Other implementation observations

- `WithdrawalRequestPage` explicitly labels the form temporary preview-only and does not submit or persist a withdrawal. Do not invent a withdrawal workflow or connect it to finance tables without product approval and a reviewed business contract.
- `LiveChatPage` is a UI fallback; no live-chat provider is connected.
- Several pages include development-only preview fixtures. They are not evidence of persisted production data or a real workflow.
- The current app tree has a developer dashboard page, but the admin module contains only its README in this branch snapshot; a complete admin workflow/API mapping remains outstanding.
- Signup uses Supabase Auth; role retrieval reads `user_roles`. Candidate signup creates only the default tester role, which is compatible with the intended privilege boundary.

## Candidate-only SQL defects found and corrected

A focused semantic review found two incorrect correlated predicates in the generated policies:

- `cohort_tests_select_participants_v2` compared `a.cohort_id` and `a.test_id` to themselves. It now correlates assignments to the current `cohort_tests` row.
- `support_attachments_select_ticket_participants_v2` compared `m.ticket_id` to itself. It now requires the ticket referenced by the message to equal the attachment row's `ticket_id`.

Both fixes were applied to the isolated FixLab candidate and the source file `supabase/rebuild-v2/002_security.sql`. The security contract test was strengthened to assert these exact correlated predicates and reject the previous tautologies. The updated test returned `rebuild_v2_security_contract: PASS`.

This is still not a substitute for synthetic-user RLS tests; FixLab has no synthetic Auth users yet.

## Next steps (single branch, no production changes)

1. Finish a complete inventory of all direct `.from()`, `.rpc()`, and Storage calls in every route/module, including admin/developer flows.
2. Decide canonical field semantics for points ledger, assignment lifecycle dates/rewards, check-in evidence, and subscription display.
3. Implement only the missing RPCs/policies proven necessary by the application contract; keep all privileged financial state server-owned and idempotent.
4. Add a Storage plan for existing buckets without deleting or renaming any production bucket/object.
5. Run TypeScript typecheck/build and a disposable schema replay, then real synthetic-user RLS tests for tester/developer/support/financial/admin.
6. Require verified restorable backup and explicit cutover approval before production changes.

## Validation status

- Candidate schema introspection was read from isolated TestDZ-FixLab.
- Candidate currently contains 43 tables and seven private helper functions; none of the application RPC names listed above exist in the candidate schemas.
- The two correlated-policy defects described above were fixed in the candidate and source SQL; the strengthened security contract test passed after the fix.
- No application compatibility patch has been applied yet.
- No production database, Auth, Storage, or migration history was changed.
