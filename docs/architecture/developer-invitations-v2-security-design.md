# Developer tester invitations — V2 security design

**Status:** design only. This document does not enable invitation code, schema, provider, or hosted configuration.

## Verified current baseline
- The six-step wizard stores validated V2 test configuration and explicitly rejects raw tester email lists and Google Group addresses.
- The current Developer Testers page shows aggregate monitoring; it does not provide invitation records or email delivery.
- Enrollment uses the existing secure `rebuild_v2.join_test(test_id)` path. It checks the Tester role, banned status, test and app state, date window, cohort capacity, and duplicate assignment.
- The notification outbox creates in-app notifications only. `dispatch-notifications` is not an email sender.
- `supabase/config.toml` uses local Mailpit SMTP. This is not a hosted provider configuration.
- No invitation table, invitation RPC, token redemption flow, or verified outbound email provider exists in the inspected candidate branch.

## Required lifecycle
1. **Create.** An authenticated Developer uses a server-side Edge Function. Verify the session with Supabase Auth, check Developer role and test ownership, normalize the recipient email, generate a cryptographically random one-time token, and hash it with Web Crypto SHA-256.
2. **Persist.** Store only the token hash, normalized email, test/cohort IDs, owner, status, expiry, idempotency key, and timestamps. Never store the raw token. Use a narrowly scoped owner-checked RPC.
3. **Deliver.** If an approved provider is configured, send the redemption URL through a server-side adapter. Otherwise show `Link ready — not emailed` and allow the owner to copy the link. Never claim email was sent without provider confirmation.
4. **Redeem.** Require an authenticated Tester with a confirmed Auth email matching the invitation recipient. Verify token hash, pending status, expiry, revocation, test eligibility, and cohort capacity. In one transaction, call the existing private join implementation and mark the invitation accepted.
5. **Revoke/expire.** Only the owning Developer or authorized Admin may revoke a pending invitation. Expiry is enforced at redemption; cleanup jobs are optional.
6. **Observe.** Owners see only their own invitation statuses and masked email addresses. Do not expose recipient user IDs or another developer's invitations.

## Candidate data model
- UUID primary key; test ID; cohort ID; developer ID; normalized recipient email; SHA-256 token hash; status (`pending`, `accepted`, `revoked`, `expired`, `delivery_failed`); expiry; creator and timestamps; accepted/revoked actor and timestamps; revocation reason; idempotency key.
- Optional delivery metadata: provider name, provider message ID, delivered timestamp, and sanitized error code only.
- Unique token hash; unique owner/idempotency key; partial uniqueness for one pending invitation per test and normalized email.
- Composite foreign keys must prove the cohort belongs to the same test and developer.
- RLS enabled and forced. No direct table grants to `anon` or `authenticated`; all operations through audited RPCs.

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
1. Candidate-only schema and RPCs plus rolled-back SQL contracts.
2. Edge Function create/list/revoke/redeem with Web Crypto token handling.
3. Isolated V2 SQL replay, PostgREST boundary checks, Deno typecheck, and security contracts.
4. Developer invitation management UI; initially copy-link only.
5. Provider adapter and signed webhooks in a separate change after provider approval.
6. Mobile/desktop/RTL visual QA and end-to-end tests with synthetic Auth users.
7. Keep all changes Draft/unmerged until reviewed. No hosted migration, secrets, cron, email delivery, or deployment without explicit approval.

## Explicit non-goals
- No automatic Developer/Admin role grant.
- No direct client inserts into `assignments`.
- No persistent raw CSV or Google Group address lists in wizard configuration.
- No email sending from the browser.
- No treating an in-app notification as an email receipt.
- No hosted Supabase migration or Edge Function deployment as part of this design.