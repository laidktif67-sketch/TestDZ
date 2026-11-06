# TestDZ — Master Blueprint v2.0

**Status:** implementation reference  
**Revision date:** 2026-11-06  
**Project:** TestDZ only — Supabase ref `naqjjykcglxiobkmdllj`

This document consolidates the founder's Master Blueprint with the implementation decisions and safety corrections made during database setup. It supersedes informal notes, but does not authorize changes to the separate Achrili project.

## 1. Vision and V1 scope

TestDZ is an Algeria-first platform that coordinates Android developers and testers in organized closed-testing cohorts. It manages apps, testing cycles, tester assignments, daily check-ins, useful feedback, subscriptions, credits, and administrative trust/safety workflows.

V1 includes:
- Authentication, profiles, multi-role authorization
- Apps, tests, cohorts, assignments, check-ins, feedback and internal reviews
- Separate earned-points and purchased-credit wallets
- Configurable plans, subscriptions, payments and manual refunds
- Admin dashboard, reports, disputes and fraud review
- PWA delivery

Out of V1: iOS/web app testing, public API, standalone marketplace, browser extension, Play Console API integration, and live chat.

**Google Play distinction:** TestDZ check-ins are not proof of continuous Google Play opt-in. Store opt-in/opt-out evidence separately and never guarantee eligibility or a tester count.

## 2. Binding principles

1. Earned points and purchased credits are separate balances and cannot be converted.
2. Subscription rows are authoritative; profile tier is only a cache.
3. Payment activation requires a verified, signed, idempotent provider webhook.
4. Product copy must not guarantee tester counts or Play Console eligibility.
5. An app is a stable entity; each test is a separate cycle.
6. Activity and quality are different metrics.
7. Fraud scoring uses multiple signals and creates human review work only.
8. Prices, limits, rewards, plans and thresholds are configurable in the database.
9. No production mock data; demo mode must be explicitly isolated and labelled.
10. No user-controlled role, verification, ban, or subscription-tier escalation.
11. At most one current subscription per user (active/trialing/past_due).
12. Refunds are a separate, auditable workflow.
13. Ledger and audit history are append-only; corrections use compensating entries.
14. Device/IP signals are probabilistic and are not proof of abuse.
15. All exposed tables require explicit grants and RLS.
16. Secrets/service-role credentials remain server-side and never enter Git.

### Assignment completion policy — implementation gate

The current product rule is 14 consecutive calendar days and one valid TestDZ check-in on each required day (14/14), plus feedback and developer confirmation or controlled auto-validation after the configured waiting period. An interruption fails the assignment.

**Open conflict requiring founder confirmation before implementing the completion engine:** earlier accepted requirements allowed a documented medical exception approved by an administrator with day-by-day extension; this v2.0 blueprint says “no exceptions”. Do not silently choose between these two policies. Current schema retains medical-exception audit fields but does not yet implement completion transitions.

## 3. Architecture and stack

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui, RTL-first
- State/data: Zustand + TanStack Query
- Routing: React Router
- PWA: vite-plugin-pwa
- Backend: Supabase Auth, PostgreSQL 17, Storage, Edge Functions
- Payments: Chargily (disabled until verified webhook integration is implemented)
- Email: Supabase Auth SMTP initially; Resend can be configured before launch
- Hosting: Vercel
- CI: GitHub Actions
- Monitoring: Sentry + Supabase logs

Supabase region: `eu-west-3` (Paris). Domain candidate: `testdz.app`; connect only after domain ownership and DNS are confirmed.

## 4. Identity and roles

Supabase `auth.users` is the authentication identity source. `public.profiles` stores public/profile attributes; do not duplicate email/password identity in a separate user table. `public.user_roles` stores backend-managed multi-role assignments.

Roles: tester, developer, admin, support. A person may have tester and developer roles simultaneously. Guest is an unauthenticated access state, not a stored role. Role assignment is never available to client writes.

On Auth user creation, a database trigger creates:
- a profile row
- the default tester role
- an empty wallet

## 5. Data domains

### Identity
- `auth.users` (Supabase Auth)
- `profiles`
- `user_roles`
- `devices`

### Testing
- `apps`
- `tests`
- `cohorts`
- `assignments`
- `checkins`
- `feedback`
- `play_opt_in_events`
- `reviews` (not yet implemented; semantics must be defined as internal collaboration reviews, never incentivized Google Play ratings)

### Economy
- `plans`
- `subscriptions`
- `payments`
- `refunds`
- `wallets`
- `points_ledger`
- `coupons`
- `coupon_redemptions)

### Trust and safety
- `reports`
- `disputes`
- `fraud_events`
- `fraud_reviews`
- `audit_logs`

### Platform
- `notifications`
- `feature_usage`
- `referrals`
- `platform_config`
- `events` (transactional outbox)

The live database currently has 28 public tables. The blueprint's “26 tables” count is not a hard constraint: it omits some operational entities and lists a separate users table that is intentionally represented by Supabase Auth plus profiles.

## 6. Lifecycle rules

### App
Draft → published/active → paused/archived; administrative blocking is a privileged action.

### Test
Recruiting → ready → running → at_risk → completed/failed/cancelled.

A test starts only when its start condition is reached and the required number of eligible active assignments is met. The minimum defaults to 12 but is configurable.

### Assignment
Pending → active → completed/withdrawn/failed/rejected.

Completion requires the full approved consecutive-day/check-in policy, feedback, and developer confirmation or controlled auto-validation. A replacement tester never inherits another tester's elapsed duration.

### Cohort
Formation uses subscription priority, waiting time, reputation and device compatibility. Cohort sizes and extra capacity are configurable; initial Free/Plus/Pro values are proposals, not promises.

## 7. Wallet and ledger

- `earned_points`: earned through platform activity; not purchasable or cashable.
- `purchased_credits`: purchased in DZD and consumed for platform services.
- Every balance mutation must be a trusted server-side transaction with row locking, unique idempotency key, non-negative balance checks and ledger insert in the same transaction.
- Clients cannot insert/update/delete ledger entries or update wallet balances.
- Reversals are new ledger entries; never rewrite history.

The example `award_points` SQL in the supplied blueprint is illustrative only and must not be copied as-is. Its caller authorization, duplicate-key race handling, balance checks and wallet locking must be implemented before use.

## 8. Subscription and payment

- Subscription table is source of truth.
- One current row per user across active/trialing/past_due.
- Renewal and provider webhooks must be idempotent.
- Trial, referrals and payments start disabled.
- Checkout creates a pending payment server-side.
- Only a verified signed Chargily webhook can mark payment successful and activate a subscription or credit balance.
- Browser return URLs never activate payment.
- Refund requests are separate records; admin approval and processing are audited.

## 9. Trust and safety

Fraud score 60–79: normal review queue. Score 80–100: high-priority queue with a 24-hour review target. No automatic suspension at any score.

Suspension requires explicit admin action, audit event, user notification and a seven-day appeal path. Device/IP sharing is a review signal only.

## 10. Initial configurable values

These are proposals only and remain disabled or adjustable until validated:
- Assignment completion reward: 50 earned points
- Quality-approved detailed feedback: 10 earned points
- Daily check-in: 2 earned points, at most 14 per test
- Verified signup: 10 points
- Referral qualification reward: 15 points
- Credit packages: 100/200 DZD, 500/900 DZD, 1500/2400 DZD, 5000/7000 DZD
- Daily points cap: 200
- Referrals per month: 5
- Check-ins per day/IP: 20
- Points expiry: 365 days

Never reward positive Google Play stars or reviews.

## 11. Feature flags

Seeded in `platform_config` with safe defaults:
- trial.enabled = false
- referral.enabled = false
- payments.enabled = false
- payments.gateway = chargily
- fraud.auto_suspend = false
- cohort.auto_form = true
- configurable trial duration, rewards, cohort sizes and check-in text minimum

Every privileged configuration update must be audited.

## 12. Screens

Public: Landing, Pricing, Login/Register.  
Tester: Dashboard, Discover, My Tests, Test Detail, Profile.  
Developer: Dashboard, My Apps, App Detail, Create Test, Reviews, Billing.  
Admin: Overview, Users, Plans & Config, Disputes & Reports.

Design system proposal: emerald primary `#10B981`, red accent `#EF4444`, slate dark surfaces, IBM Plex Sans Arabic + Inter, 4px spacing scale, 8/12/16/24px radii. Implement RTL and responsive layouts from the start.

## 13. API and Edge Functions

Planned Edge Functions:
- `create-checkout`
- `chargily-webhook`
- `daily-cron`
- `send-notification`

Planned RPCs:
- `get_active_subscription()` (implemented; returns only the caller's subscription)
- `award_points` (not yet implemented)
- `create_test`
- `form_cohort`
- `submit_checkin`
- `submit_feedback`
- `suspend_user`
- `process_payment_webhook`
- `create_refund_request`
- `approve_refund`
- `check_feature_limit`

RPCs must validate the caller and keep privileged functions in a non-exposed schema where possible. Any exposed SECURITY DEFINER RPC needs a narrow purpose, fixed search_path, strict identity checks and minimal EXECUTE grants.

## 14. Current implementation state

Completed in dedicated TestDZ Supabase project:
- Initial core relational schema and RLS
- Foreign-key lookup indexes
- Devices, fraud events, coupons, coupon redemptions, referrals, feature usage and event outbox
- Append-only protection for points ledger and audit logs
- Restricted client update grants for app/test records
- Auth user bootstrap trigger for profile, tester role and wallet
- React/Vite frontend scaffold, RTL landing page, sign-in/sign-up flow, session-aware dashboard shell and PWA manifest
- GitHub Actions CI workflow for frontend typecheck and production build
- Caller-scoped `get_active_subscription()`
- Coupon redemption payment index

All 28 public tables currently have RLS enabled. Several operational tables intentionally have no client policies and no authenticated grants; access will be provided only through narrowly scoped server-side operations.

## 15. Remaining phases

1. Confirm the medical-exception policy conflict.
2. Implement assignment/check-in state machine and database-level 14-day enforcement.
3. Implement secure wallet RPCs and append-only ledger operations.
4. Complete admin authorization, suspension, audit and appeals.
5. Implement plans, limits and subscription lifecycle.
6. Implement Chargily checkout/webhook only after provider signature details are verified.
7. Build React/Vite frontend and auth flows.
8. Build developer and tester journeys.
9. Build admin and trust/safety screens.
10. Add notifications, PWA, CI/CD, deployment and private beta.

## 16. Explicitly deferred

- Do not create or modify the separate Achrili project.
- Do not enable payment, trial or referral flags in production until their workflows are tested.
- Do not create fake production users, apps, cohorts or payments.
- Do not claim Play Store compliance based solely on TestDZ activity.
- Do not expose service-role credentials in the frontend or repository.
