# Admin, Financial and Support Role Boundaries — V2 Audit

**Audit date:** 2026-11-19  
**Source baseline:** PR #112 head `b2010d9c58768101350714add72bc6f27f394df6`  
**Scope:** reconcile candidate SQL role model, mounted routes, frontend API calls and current write boundaries. Source-only review; no hosted database access.

## 1. Role model and assignment

Candidate schema `supabase/rebuild-v2/001_schema.sql` defines `tester`, `developer`, `admin`, `financial`, and `support` roles. There is no Moderator role in this V2 role constraint.

Candidate SQL `002_security.sql` and `023_admin_role_grants.sql` establish:
- Only an existing Admin can grant roles.
- Client-facing grants allow `tester`, `developer`, `financial`, and `support`; Admin is deliberately excluded.
- Self-grants are rejected in the hardened grant path.
- A reason is required and role grants append an audit event.
- New accounts receive only the Tester role through the auth-user bootstrap.
- Developer access requests are the only self-service role request in the inspected schema; the Admin queue approves/rejects them with a required decision note.

Mounted UI confirms the same policy:
- `/admin/users` shows account roles and offers grants for Tester/Developer/Financial/Support only; it does not offer Admin grants, self-grants or role removal.
- `/admin/role-requests` handles Developer requests only.
- Admin pages are protected by the Admin role guard.

## 2. Route-level access

`apps/web/src/App.tsx` and `RoleGuard.tsx` establish:
- Admin routes: `/admin`, role requests, users, audit log, fraud review, case queues and developer review.
- Financial routes: `/financial-operations` and its disputes view.
- Support routes: support queue, reports and ticket detail.
- The guard intentionally lets Admin enter any role-protected workspace.
- Financial and Support do not inherit Admin routes.

The shared role-home redirect prioritizes Admin, then Financial, Support, Tester, Developer. A user with multiple roles therefore lands in the highest-priority workspace, while route authorization still checks the assigned role.

## 3. Financial boundary

The current Financial Operations UI is explicitly read-only:
- It reads up to 100 payment, refund and wallet-ledger records.
- The page exposes no payment verification, refund approval, payout or wallet adjustment controls.
- Disputes are metadata-only and read-only; descriptions, evidence, amounts and resolution text are excluded.

Candidate SQL `002_security.sql` includes `rebuild_v2_private.post_wallet_entry`:
- Requires Admin or Financial role.
- Validates wallet type, non-zero amount, entry type, idempotency key, reason and target profile.
- Locks the wallet row, prevents negative balances, records a ledger entry and appends an audit event.
- Enforces idempotency-key reuse against the exact original operation.

Important integration qualification: this function lives in `rebuild_v2_private`, not the exposed `rebuild_v2` RPC namespace. The candidate SQL grants authenticated EXECUTE on it and grants authenticated USAGE on the private schema, but this source audit did not verify Supabase Data API schema exposure or an end-to-end client invocation. Do not describe wallet posting as a completed Financial UI workflow. Verify API exposure and callability only in an isolated local stack before adding a wrapper or UI.

## 4. Support boundary

Mounted Support workspace includes:
- Metadata-only support queue.
- Ticket details with public conversation, public-message attachments and immutable event history.
- Public replies and status/priority changes with a required reason.
- Resolved/closed ticket restrictions; Admin can reopen tickets, Support cannot reopen resolved/closed tickets.
- Internal notes and internal-note attachments are excluded from Support detail responses.

Candidate SQL and existing support contracts use audited ticket events and role checks. Report queues are metadata-only and do not offer decisions. Support does not receive financial payment/refund/wallet records through the current mounted workspace.

## 5. Confirmed gaps and risks to resolve

1. **Moderator reconciliation:** legacy Moderator references, if still present in older UI or data, have no matching V2 role in the candidate schema. Inventory and map them before any migration; do not silently drop them or grant broader Support/Admin access.
2. **Financial write integration:** the database posting function exists, but the mounted Financial UI remains read-only and private-schema Data API reachability is unverified. Confirm local API exposure and authorization before any UI action.
3. **Refund/payment workflows:** no mounted UI workflow for verification, refund approval, payout or dispute resolution was found in the reviewed Financial and case pages.
4. **Role revocation and account controls:** Admin UI explicitly leaves role removal, banning and verification changes unavailable. Define audited workflows before implementing them.
5. **Admin bootstrap:** normal signup cannot grant Admin; initial Admin provisioning remains an out-of-band trusted bootstrap responsibility. Do not add Admin to public signup or client role-grant lists.
6. **Multi-role UI behavior:** verify users with combinations such as Admin+Financial or Financial+Support in browser tests; ensure navigation and page visibility remain consistent with the role guard and RLS.

## 6. Verification plan

Use only a disposable local Supabase stack:
- Test each role against direct table reads and writes, route guards, and every exposed RPC.
- Verify Support cannot read financial tables and Financial cannot read private support conversations/attachments.
- Verify only Admin can grant Financial/Support/Developer roles, with self-grant and Admin-grant rejected.
- Verify wallet posting rejects User/Tester/Developer/Support, enforces idempotency and prevents negative balances.
- Verify Support ticket actions are audited and closed-ticket restrictions hold.
- Run frontend typecheck/build and desktop/mobile/Arabic RTL browser QA.

## Safety

This audit changes documentation only. No application code, SQL migration, hosted Supabase, Auth, Storage, production data, secrets, Edge Function, cron or Vercel deployment was changed. All findings refer to candidate source, not a claim that the candidate schema is deployed.
