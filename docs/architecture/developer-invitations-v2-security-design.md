# Developer tester invitations — V2 security design

**Status:** candidate implementation is present on this Draft branch. SQL/RPC, JWT-verified Edge Function, Developer invitation management UI, and Tester redemption through the existing test preview are implemented. SQL/Deno and frontend checks have passed on the latest implementation head, including the final AuthGuard return-path hardening. Nothing has been applied to hosted Supabase. Nothing has been applied to hosted Supabase.

## Verified current baseline
- The six-step wizard stores validated V2 test configuration and explicitly rejects raw tester email lists and Google Group addresses.
- The current Developer Testers page shows aggregate monitoring; it does not provide invitation records or email delivery.
- Enrollment uses the existing secure `rebuild_v2.join_test(test_id)` path. It checks the Tester role, banned status, test and app state, date window, cohort capacity, and duplicate assignment.
- The notification outbox creates in-app notifications only. `dispatch-notifications` is not an email sender.
- `supabase/config.toml` uses local Mailpit SMTP. This is not a hosted provider configuration.
- The candidate branch now contains `032_developer_test_invitations.sql`, `028_developer_test_invitations_contract.sql`, and `supabase/functions/developer-invitations/index.ts`. These are unverified candidate changes until the isolated workflow passes.

## Required lifecycle
1. **Create.** An authenticated Developer uses a server-side Edge Function. Verify the session with Supabase Auth, check Developer role and test ownership, normalize the recipient email, derive a 256-bit one-time token using HMAC-SHA-256 over the authenticated user ID and client-generated UUID idempotency key, then hash it with Web Crypto SHA-256.
2. **Persist.** Store only the token hash, normalized email, test/cohort IDs, owner, status, expiry, idempotency key, and timestamps. Never store the raw token. Use a narrowly scoped owner-checked RPC.
3. **Deliver.** If an approved provider is configured, send the redemption URL through a server-side adapter. Otherwise show `Link ready — not emailed` and allow the owner to copy the link. Never claim email was sent without provider confirmation.
4. **Redeem.** Require an authenticated Tester with a confirmed Auth email matching the invitation recipient. Verify token hash, pending status, expiry, revocation, test eligibility, and cohort capacity. In one transaction, call the existing private join implementation and mark the invitation accepted.
5. **Revoke/expire.** Only the owning Developer or authorized Admin may revoke a pending invitation. Expiry is enforced at redemption; cleanup jobs are optional.
6. **Observe.** Owners see only their own invitation statuses and masked email addresses. Do not expose recipient user IDs or another developer's invitations.

## Candidate data model
- UUID primary key; test ID; developer ID; normalized recipient email; SHA-256 token hash; status (`pending`, `accepted`, `revoked`, `expired`); expiry; idempotency key; created/updated timestamps; accepted/revoked actor and timestamps; revocation reason.
- Cohort is intentionally not stored on the invitation. The existing `join_test_impl` chooses an eligible cohort and enforces its current capacity atomically at redemption.
- Unique token hash; unique owner/idempotency key; partial uniqueness for one pending invitation per test and normalized email.
- RLS enabled and forced. Direct table privileges are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`; operations go through owner/role-checked RPCs.

## Security boundaries
- `create_test_invitation`: authenticated, Developer/Admin role checked from `user_roles`, test ownership checked, strict inputs, rate-limited and idempotent.
- `list_test_invitations`: owner-scoped; masked email and safe status fields only. Never return token hashes.
- `revoke_test_invitation`: owner/Admin checked; reason required; append-only audit event.
- `redeem_test_invitation`: atomic server-side operation; checks confirmed Auth email and Tester role; calls the existing private join implementation.
- Keep private implementations in `rebuild_v2_private`; revoke anonymous and direct client execution where appropriate.
- Edge Function verifies the incoming JWT with Supabase Auth. Do not trust decoded client claims or `user_metadata` for authorization.
- Keep service-role credentials and provider API keys server-side. Never put them in browser code or `NEXT_PUBLIC_` variables.
- Do not reveal whether a recipient already has an account. Wrong-email redemption must fail without consuming the intended recipient's token.
- Token, full email, and message body must never appear in logs, analytics, browser storage, audit metadata, or notification payloads.
- Redemption cannot grant Tester, Developer, Admin, Support, or Financial roles. It only enrolls a user who already has Tester role.

## Candidate implementation added and locally validated
- `rebuild_v2.test_invitations` stores only a 32-byte SHA-256 token hash, normalized recipient email, test/developer ownership, status, expiry, idempotency key, and acceptance/revocation audit fields.
- Table RLS is enabled and forced; direct table privileges are revoked from client roles and `service_role`. The four public RPC wrappers are authenticated-only; their private implementations enforce Developer ownership, Tester role, confirmed Auth email, and existing join eligibility.
- Creation is limited to 50 pending invitations per test and expiry between 1 hour and 30 days. The current Edge Function uses a 7-day expiry and derives a pseudorandom 256-bit token with HMAC-SHA-256. This makes a retried create request reproduce the same token without storing the raw token; `DEVELOPER_INVITATION_TOKEN_SECRET` (minimum 32 characters) must be configured as an Edge Function secret before create is enabled.
- Redemption locks the invitation row, compares the confirmed Auth email, and calls `rebuild_v2_private.join_test_impl` in the same database transaction before marking the invitation accepted. Revoke and redeem therefore serialize on the same row.
- The Edge Function verifies the bearer token with `supabase.auth.getUser`, hashes tokens with Web Crypto SHA-256, and returns the raw token only in the one-time create response. It does not send email. Its status is `Link ready — not emailed`.
- Latest isolated SQL workflow run #44396148370 passed candidate script 032, final-state checks, invitation lifecycle contract 028, and local PostgREST verification. The notification/invitation Edge Function Deno type-check passed in the same run.
- Idempotency is strict: the same authenticated user and idempotency key deterministically reproduce the same token. Reusing a key with a different test or email is rejected. Expired pending rows are transitioned to `expired` before a replacement invite is inserted, so the partial unique index does not permanently block re-invites.
- The Developer Testers page now provides invitation creation, masked invitation history, revocation, and a one-time copyable link. The link opens `/tests/:id?invite=...`; the existing Tester test-preview page redeems it through the Edge Function. The AuthGuard return path is restricted to the validated invitation URL shape; it passed in the latest TestDZ CI run #44396148486 and Frontend typecheck/build run #44396148093.
- Still outstanding: full browser end-to-end Auth testing, provider integration/webhooks, and manual mobile/desktop/RTL visual QA. No email is sent.

## Provider readiness gate
Before outbound email is enabled, choose and approve a provider; verify sender domain and SPF/DKIM/DMARC; store its API key only as an Edge Function secret; review retention/terms; design signed webhook verification and replay protection; handle bounces, complaints, suppression and idempotent retries; and provide a sandbox recipient mode.

Until this gate passes, invitation links may be created and copied but must be labelled `Link ready — not emailed`. The delivery adapter must be separate from authorization and token redemption. Do not repurpose the in-app notification dispatcher.

## Required contract tests
1. Anonymous create/list/revoke/redeem denied.
2. Tester cannot create/revoke; non-owner Developer cannot operate on another test.
3. User metadata cannot grant roles.
4. Raw token never appears in database, list RPC, audit metadata, logs, or error payloads.
5. Wrong email, unconfirmed email, wrong role, expired, revoked, malformed, and unknown tokens fail safely.
6. Valid token creates exactly one assignment and one accepted state transition.
7. Duplicate redemption by the same tester is safe; concurrent redemption cannot exceed cohort capacity.
8. Forwarded token cannot be redeemed by another account and does not consume the intended recipient's token.
9. Revoke/redemption races resolve atomically.
10. Owner list is isolated; unrelated developers and testers cannot enumerate invitations.
11. Rate limits, active invitation caps, and idempotency are enforced under concurrency.
12. Delivery retries are idempotent; provider failure never marks an invitation delivered.
13. Without a provider, status explicitly says `Link ready — not emailed`.

## Implementation order
1. Candidate-only schema/RPCs, Edge Function, and rolled-back lifecycle/security contracts — implemented and locally verified.
2. Developer invitation management UI and Tester preview redemption — implemented; frontend typecheck/build passed on the implementation head.
3. Safe AuthGuard return-path preservation for invitation links — added; final frontend CI pending.
4. Full browser end-to-end Auth tests and manual mobile/desktop/RTL visual QA.
5. Provider adapter and signed webhooks in a separate change after provider approval.
6. Keep all changes Draft/unmerged until reviewed. No hosted migration, secrets, cron, email delivery, or deployment without explicit approval.

## Explicit non-goals
- No automatic Developer/Admin role grant.
- No direct client inserts into `assignments`.
- No persistent raw CSV or Google Group address lists in wizard configuration.
- No email sending from the browser.
- No treating an in-app notification as an email receipt.
- No hosted Supabase migration or Edge Function deployment as part of this design.