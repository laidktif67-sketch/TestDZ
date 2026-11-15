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
| App lifecycle RPCs | `get_app_limit`, `create_app`, `update_app`, `archive_app`, `restore_app` are called by `features/apps/apps-api.ts` | Implemented in `003_app_lifecycle.sql`; exposed wrappers are invoker functions, privileged implementations are private definer functions | Candidate RPC contract has been exercised with synthetic developer/tester users. Frontend still uses the default `public` schema, so these functions are not yet reachable from the current client until the API-schema integration is completed. |
| Onboarding | `complete_onboarding` called by `features/profiles/profiles-api.ts` | No matching RPC in candidate | Add a server-side onboarding contract that only permits safe profile fields and the approved default tester role; never accept privileged roles from browser input. |
| Active sessions | Tester Active Sessions calls `get_my_active_sessions` | No matching RPC in candidate | Determine required session data and implement a self-only, privacy-preserving function or remove the UI dependency with explicit product approval. |
| Support ticket creation | Support Center directly inserts into `support_tickets` | Candidate revokes all direct table writes; no ticket-create RPC | Add a constrained authenticated RPC (or safe RLS insert policy with immutable owner/role checks) and update client contract. |
| Support conversation replies | Ticket Details directly inserts into `support_ticket_messages` | Candidate revokes all direct table writes; no reply RPC | Add a ticket-participant-checked RPC; enforce sender = auth.uid(), closed-ticket rules, and customer inability to create internal notes. |
| Support attachment metadata | Ticket Details directly inserts into `support_ticket_attachments` | Candidate revokes all direct table writes; no attachment RPC | Add metadata RPC/policy tied to an existing message, ticket participant, uploader, validated path, size and MIME type. |
| Notification read state | Notifications Center updates `notifications.read_at` directly | Candidate revokes all direct table writes | Add a self-only mark-read RPC or a narrowly scoped update policy with both USING and WITH CHECK. |
| Storage | App uses `avatars`, `app-icons`, `support-attachments`; other screens reference test evidence/media | Candidate SQL has no bucket/policy provisioning plan yet | Inventory production bucket names/configuration and define private/public access and path policies per feature before cutover. |
| Data API schema | `supabase/config.toml` exposes only `public` and `graphql_public`; `createClient<Database>()` has no schema override; generated `Database` types describe `public` | Candidate tables are in `rebuild_v2`; helper routines are in `rebuild_v2_private` | Candidate is not reachable through the current frontend Data API contract. Choose a deliberate deployment strategy: keep the isolated schema until validation, then cut over into `public` with private helpers unexposed, or explicitly expose a dedicated API schema and update client schema/types. Do not expose the private helper schema. |

## Confirmed field/table mismatches

- `points_ledger` is referenced by Wallet & Rewards, Feedback History, Check-in History, Activity History, Notifications Center, Privacy/Data export, completion/reward screens, leaderboard, and active assignment progress. Candidate has `wallet_ledger` with `wallet_type`, `amount`, `entry_type`, `reference_type`, `reference_id`, `idempotency_key`, `actor_id`, `reason`, and `created_at`.
- `assignments.start_date` and `assignments.points_awarded` are queried by assignment details/submission, activity, completion summary/reward, privacy export, and active progress. Candidate has no such columns.
- `checkins.evidence_url` is queried by Active Assignment Progress; candidate has `evidence_path`.
- Privacy export requests `profiles.subscription_tier`; candidate profiles does not contain that field. The canonical source should likely be `subscriptions` joined to `plans`, but UI/export semantics must be checked before refactoring.
- UI identity role allow-list currently contains `tester`, `developer`, `admin`, `support`; candidate additionally supports `financial`. Staff-role visibility and routing need a deliberate UI contract. Financial access must not be granted through public onboarding or user-editable metadata.
- `apps-api.ts` selects the app fields already present in candidate `apps`; app lifecycle RPCs now exist in `003_app_lifecycle.sql`. The candidate still needs an intentional Data API schema/client integration before the frontend can call them.
- The current `supabase/config.toml` and typed Supabase client are still public-schema oriented. The candidate schema is isolated and intentionally not exposed, so it must not be treated as a drop-in replacement yet.
- `SubmitFeedbackPage` and `ReportProblemPage` currently show form UI but have no direct Supabase table/RPC calls in the reviewed page source. Their submission behavior needs a product/API decision before claiming those workflows are backed by the candidate `feedback` and `reports` tables.
- Support UI reads candidate-compatible columns for tickets/messages/attachments, but direct write behavior is incompatible with candidate privileges.

## Other implementation observations

- `WithdrawalRequestPage` explicitly labels the form temporary preview-only and does not submit or persist a withdrawal. Do not invent a withdrawal workflow or connect it to finance tables without product approval and a reviewed business contract.
- `LiveChatPage` is a UI fallback; no live-chat provider is connected.
- Several pages include development-only preview fixtures. They are not evidence of persisted production data or a real workflow.
- The current app tree has a developer dashboard page, but the admin module contains only its README in this branch snapshot; a complete admin workflow/API mapping remains outstanding.
- Signup uses Supabase Auth; role retrieval reads `user_roles`. Candidate signup creates only the default tester role, which is compatible with the intended privilege boundary.

## Expanded route and data-contract inventory

The application route tree in `apps/web/src/App.tsx` includes public Auth/verification/reset routes, onboarding/profile completion, tester workflows, developer app management, support, wallet/withdrawal, and an admin placeholder route. The candidate schema covers many of these domains structurally, but the current application is not yet wired to it.

| Workflow / route group | Current source contract | Candidate objects | Status |
|---|---|---|---|
| Auth and identity | Supabase Auth plus `user_roles` select for the current user | Auth trigger, profiles, user_roles | Signup default tester role aligns conceptually; frontend role allow-list omits candidate `financial` and does not explicitly model a public `user` role. Keep privileged role grants out of signup metadata. |
| Onboarding/profile | `profiles` reads/updates; `complete_onboarding(p_roles,p_interests)` RPC | profiles, user_roles, role_requests | RPC missing. The client passes roles, so server logic must whitelist self-service roles and ignore/reject admin, financial, support. Profile completion fields need exact mapping. |
| Developer apps | apps list/detail queries; `get_app_limit`, `create_app`, `update_app`, `archive_app`, `restore_app` RPCs; app-icons upload | apps, plans/subscriptions, Storage | Five RPCs implemented and behavior-tested in FixLab; client still targets `public`, and Storage bucket policies still need candidate-specific testing. |
| Discover tests | tests query with app relation; reads assignments/wallets/notifications | tests, apps, assignments, wallets, notifications | Core read model exists, but assignment start-date field and candidate API schema exposure must be reconciled. |
| My tests / assignment details | assignments with tests/apps/checkins; feedback history; reads points ledger | assignments, tests, apps, checkins, feedback, wallet_ledger | `start_date` and `points_awarded` mismatches; `points_ledger` rename; candidate assignment lifecycle uses assigned_at/started_at/completed_at/due_at. |
| Assignment submission / check-in | Reads assignment/checkins/feedback; active progress reads `checkins.evidence_url`; other parts of UI show evidence upload | assignments, checkins, test_media, feedback, wallet_ledger | Candidate has `evidence_path`, not `evidence_url`. Need confirm whether check-in creation and evidence uploads are actually connected; no direct check-in insert was found in reviewed page code. |
| Wallet / rewards | Reads `wallets` and `points_ledger`; rewards are shown from ledger rows | wallets, wallet_ledger | Table rename and field semantics must be mapped. Candidate wallet ledger is append-only and should remain server-written. |
| Withdrawal | Request page explicitly preview-only; status page explicitly says no request submitted | wallets, wallet_ledger, payments, refunds | No withdrawal table/workflow exists. Do not invent payout logic or let the UI imply an active request. |
| Feedback | Feedback History reads feedback and points ledger; Submit Feedback page currently has UI/file selection but no persistence call | feedback, wallet_ledger, test_media | Submission is not connected in the reviewed source. Need a validated submission RPC/storage contract; never trust client quality_status/review fields. |
| Reports/problem | Report Problem explicitly tells the user submission is not connected and no report was sent | reports, report_attachments | Candidate objects exist, but page has no insert/RPC or attachment upload. |
| Support | Direct inserts into support_tickets, support_ticket_messages, support_ticket_attachments; upload to support-attachments; signed URL reads | support_tickets, support_ticket_messages, support_ticket_attachments, support_ticket_events | Read contracts largely align; direct writes conflict with candidate grants. Missing create-ticket, reply, attachment-metadata RPCs. Must preserve internal_note privacy and ticket participant checks. |
| Notifications | Reads own notifications; direct update of read_at for one/all | notifications | Candidate currently has owner SELECT policy and no direct update grant. Add self-only mark-read RPC or narrowly scoped update policy with USING and WITH CHECK. |
| Active sessions | `get_my_active_sessions()` RPC | devices | RPC missing. Device registration/revocation and session semantics need to be specified; do not expose auth.sessions wholesale. |
| Login/security history | `get_my_security_activity(p_limit)` RPC | devices, audit_events, events | RPC missing. Define exactly which events are visible to the account owner and keep security metadata private. |
| Leaderboard | Directly enumerates all tester user_roles, profiles, points_ledger rows, and completed assignments | user_roles, profiles, wallet_ledger, assignments | **Privacy/compatibility blocker.** Candidate RLS intentionally restricts profiles and roles to self/admin and ledger to owner/financial/admin, so the current client-side cross-user query must not be enabled. Design a safe aggregate leaderboard RPC/view with explicit opt-in/visibility rules and no email/private profile fields. |
| Referrals | Referral pages currently show no referral table/RPC reads in reviewed source | referrals, coupons, coupon_redemptions | Candidate tables exist but UI is not connected. Define referral code generation, attribution, abuse controls and reward posting before connecting. |
| Privacy export | Exports profiles, assignments, checkins, feedback, notifications, points_ledger; asks for profiles.subscription_tier | profiles, assignments, checkins, feedback, notifications, wallet_ledger, subscriptions/plans | Map points_ledger to wallet_ledger and derive subscription tier from subscription/plan state; candidate profiles has no subscription_tier. Export must not include other users' or staff-only data. |
| Avatars | Uploads versioned user paths to `avatars`, stores public URL in profile, attempts best-effort cleanup | profiles, Storage | Bucket/policies absent from candidate. Decide public avatar visibility and owner-only upload/delete path constraints. |
| App icons | Uploads `{userId}/{appId}/icon.ext` to `app-icons`, then stores public URL | apps, Storage | Bucket/policies absent. Restrict upload path to owning developer/app and validate MIME/size; public read only if intended. |
| Support attachments | Uploads `{ticketId}/{userId}/{uuid-name}` to `support-attachments`; signed URL read for 60 seconds | support ticket tables, Storage | Bucket/policies absent. Must remain private and enforce ticket participant + uploader path ownership. |
| Admin | Current route renders a generic TesterSection placeholder; no full admin feature module in this branch tree | platform_config, audit_events, fraud_reviews, payments/refunds, role_requests, finance tables | Admin workflows are not fully represented in the current UI branch. Do not infer missing admin operations from schema alone. |

## Additional confirmed issues from candidate-policy comparison

- Candidate `profiles_select_self_or_admin_v2` and `roles_select_self_or_admin_v2` intentionally prevent a tester from enumerating other users. This conflicts with the current leaderboard's direct cross-user queries. Do not weaken those RLS policies to make the leaderboard work.
- Candidate `wallet_ledger` and `wallets` expose rows only to the owner and financial/admin staff. The current leaderboard must not query raw ledger rows across users.
- Candidate `notifications` currently has an owner-only SELECT policy; the current UI updates `read_at` directly, so mark-read behavior needs a constrained server-side contract.
- Candidate support message rows include `internal_note`; the client query currently selects only public message fields, which is good, but the write path must never let a customer set `internal_note=true`.
- The frontend currently uses a public schema Supabase client, while candidate objects are in `rebuild_v2`; the candidate remains intentionally unexposed. A schema/API cutover plan is required before any app call can reach it.

## Real synthetic-user RLS isolation test (FixLab only)

Two synthetic Auth users were created in the isolated `TestDZ-FixLab` project. Their user metadata deliberately contained forged `role: admin` and `role: financial` values to test that the signup trigger does not trust browser-controlled role metadata.

Observed results while executing as the `authenticated` database role with each user's JWT subject set:

- Each user could read exactly their own profile, own role row, and own wallet row.
- Each user received zero rows for the other user's profile, role, and wallet.
- The generated role for both accounts was only `tester`; neither forged metadata role was granted.
- `authenticated` had no UPDATE privilege on `rebuild_v2.wallets` and no INSERT privilege on `rebuild_v2.wallet_ledger`.
- Calling the privileged `grant_role` function as a tester to grant another user `admin` failed with `forbidden: admin role required`.

The two synthetic Auth users and their generated profile, role, and wallet rows were then removed. A read-back confirmed zero remaining synthetic Auth users, profiles, roles, or wallets. No production Auth users were involved.

This verifies a narrow but meaningful part of the RLS model. It does not yet cover developer/support/financial/admin sessions, cross-tenant app/test visibility, assignment mutation, ticket internal notes, Storage object paths, or all RPCs.

## Production Storage inventory (read-only)

The production project `TestDZ` currently has five buckets and zero objects:

| Bucket | Public | Max size | Allowed MIME types | Candidate status |
|---|---:|---:|---|---|
| `avatars` | Yes | 2 MiB | JPEG, PNG, WebP | Must preserve; candidate policies not yet added |
| `app-icons` | Yes | 512 KB | PNG, JPEG | Must preserve; candidate policies not yet added |
| `developer-feedback-attachments` | No | 10 MiB | PNG, JPEG, WebP, TXT, PDF, ZIP | Must preserve; candidate policies not yet added |
| `support-attachments` | No | 10 MiB | PNG, JPEG, WebP, TXT, PDF, ZIP | Must preserve; candidate policies not yet added |
| `test-evidence` | No | 10 MiB | PNG, JPEG, WebP, TXT, PDF, ZIP | Must preserve; candidate policies not yet added |

Production currently has Storage object policies for owner-scoped avatar/app-icon uploads, public reads for public image buckets, participant-scoped private support/developer-feedback attachments, and assignment-participant evidence access. These policies must be re-authored against the new canonical schema and tested before cutover; they cannot simply be assumed to follow the candidate table policies. No bucket or object was changed.

## Existing production RPC contracts recovered (read-only)

The live production database contains implementations for several RPCs that were missing from the candidate. Their current behavior was inspected read-only so the replacement can preserve the established contract rather than inventing new workflow semantics.

### Developer app lifecycle

Existing production RPCs and implementation behavior:

- `get_app_limit()`: returns plan code, max active apps, current active apps, and whether another app can be created. It uses the active subscription's `plans.limits.max_active_apps`, falls back to the active `free` plan, then defaults to one app.
- `create_app(...)`: requires an authenticated developer/admin; validates name (3–50), description (20–500), package name syntax, and category; takes a per-user advisory transaction lock; checks the plan limit; creates a `draft` app.
- `update_app(...)`: validates metadata and HTTPS icon URL; only updates a non-archived app owned by the caller.
- `archive_app(...)`: only archives an owned, non-archived app and remembers its previous status.
- `restore_app(...)`: rechecks the plan limit under the same per-user advisory lock and restores the remembered status.

Candidate compatibility corrections already made in both FixLab and `001_schema.sql`:

- Added `plans.limits jsonb NOT NULL DEFAULT '{}'` (candidate previously retained `features` but omitted the distinct `limits` field used by production quota logic).
- Added `apps.archived_from_status text` (required to restore the previous app status safely).

These column additions were replay-tested. The five app lifecycle RPCs were implemented in `003_app_lifecycle.sql` using the recovered production contract. Do not replace plan limits with an assumed field inside `features`.

### Onboarding and account security RPCs

Production behavior inspected:

- `complete_onboarding(p_roles,p_interests)`: requires auth; accepts 1–2 roles from only `tester` and `developer`; accepts an interests JSON array of at most 20 entries; updates profile onboarding state. It does not permit `admin`, `financial`, or `support` self-assignment.
- `get_my_active_sessions()`: returns only the caller's active Auth sessions, including last-active time, user agent, IP address, assurance level, and current-session marker.
- `get_my_security_activity(p_limit)`: returns only the caller's Auth audit events, clamps the requested limit to 1–100, and returns event/time/IP fields.

Candidate has no corresponding exposed RPCs yet. `devices` is not a drop-in replacement for `auth.sessions`; preserve the existing session semantics by using a carefully scoped private function over `auth.sessions`. Security activity should use the Auth audit source, not expose all rows in `audit_events`.

## Developer app lifecycle RPC verification (FixLab only)

The new `003_app_lifecycle.sql` was applied to the isolated candidate. The following synthetic-user tests passed:

- A developer received `get_app_limit()` = free plan, limit 1, used 0, can_create true.
- The developer created one app; the quota then returned used 1 and can_create false.
- A tester-role account attempting `create_app` was rejected with `DEVELOPER_ROLE_REQUIRED`.
- Archiving the first app released the active-app slot; a second app could be created.
- Restoring the first app while the second occupied the only free-plan slot was rejected with `PLAN_LIMIT_REACHED`.
- The app owner could update their own app metadata and HTTPS icon URL.
- A different authenticated user attempting to update that app was rejected with `APP_NOT_FOUND_OR_NOT_OWNED`.

All synthetic users, generated profiles/roles/wallets, test apps, and the temporary free plan were removed. Read-back confirmed zero remaining test users, profiles, wallets, apps, or test plan rows.

The security contract test was extended to assert RPC existence, authenticated-only execution, no anon execution, invoker wrappers, private definer implementations, and required app compatibility columns. It returned `rebuild_v2_security_contract: PASS`.

## Latest replay and advisor notes

After adding the two confirmed app compatibility columns and the app lifecycle RPC script, all three source scripts were replayed into temporary schemas again:

- 43 tables, all 43 with forced RLS.
- 44 policies covering all 43 tables.
- All five developer app RPCs present; zero anon EXECUTE grants and five authenticated EXECUTE grants.
- Zero authenticated direct table INSERT/UPDATE/DELETE grants.
- Both new compatibility columns present.
- Temporary replay schemas dropped after verification.

Supabase advisor output for the production project still reports four INFO findings for RLS-enabled `public` tables without policies: `audit_logs`, `fraud_reviews`, `platform_config`, and `user_roles`. These are default-deny at the RLS layer, not proof of public data exposure, but need review. The performance advisor reports 28 unindexed foreign keys in the existing production `public` schema. These are production findings, not evidence that the isolated candidate schema has the same defects. The advisor output did not enumerate the non-public candidate schema, so candidate-specific index review remains a separate check.

## Candidate-only SQL defects found and corrected

A focused semantic review found two incorrect correlated predicates in the generated policies:

- `cohort_tests_select_participants_v2` compared `a.cohort_id` and `a.test_id` to themselves. It now correlates assignments to the current `cohort_tests` row.
- `support_attachments_select_ticket_participants_v2` compared `m.ticket_id` to itself. It now requires the ticket referenced by the message to equal the attachment row's `ticket_id`.

Both fixes were applied to the isolated FixLab candidate and the source file `supabase/rebuild-v2/002_security.sql`. The security contract test was strengthened to assert these exact correlated predicates and reject the previous tautologies. The updated test returned `rebuild_v2_security_contract: PASS`.

This is still not a substitute for synthetic-user RLS tests; FixLab has no synthetic Auth users yet. A clean isolated replay of the updated source scripts (with only the shared `auth.users` trigger attachment omitted) completed: 43 tables, 43 forced-RLS tables, 44 policies covering 43 tables, zero authenticated direct write grants, and zero occurrences of the two previous tautologies. The temporary replay schemas were dropped afterward.

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
- Updated source scripts replayed into temporary isolated schemas: 43 tables, 43 forced-RLS tables, 44 policies covering all 43 tables, zero direct authenticated table write grants, and zero of the two known tautological predicates. Temporary replay schemas were dropped after verification.
- Two synthetic Auth users were used for a real RLS isolation test in FixLab and fully cleaned up; no synthetic users remain.
- Production Storage inventory was read-only confirmed: five existing buckets and zero objects; bucket policies need candidate-specific reconstruction.
- Candidate schema and SQL now preserve the production app quota fields `plans.limits` and `apps.archived_from_status`; the full replay passed.
- Existing production contracts for app lifecycle, onboarding, active sessions, and security history were inspected read-only. App lifecycle RPCs have now been ported and tested; onboarding/session/security-history RPCs remain to be implemented.
- No frontend compatibility patch has been applied yet.
- No production database, Auth, Storage, or migration history was changed.
