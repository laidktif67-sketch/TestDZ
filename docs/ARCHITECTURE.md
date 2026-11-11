# TestDZ Platform Architecture

## Product

TestDZ is an Algeria-first platform for organizing Android closed-testing cohorts. It coordinates developers, apps, testing cycles, tester assignments, daily check-ins, feedback, subscriptions, credits, and administrative review.

## Approved target application architecture

- Repository: npm-workspaces monorepo. The existing web application lives in `apps/web/`; the Supabase project configuration and migrations remain in the top-level `supabase/` directory.
- Web client: the existing React + TypeScript + Vite application, with React Router and PWA support. This is the current implemented client.
- Mobile client: a separate React Native + Expo application planned under `apps/mobile/`. It has not been created yet; do not treat mobile screens or native capabilities as implemented.
- Backend: one shared Supabase project (Auth, PostgreSQL, Storage, and narrowly scoped RPC/Edge Functions) used by both clients. No database migration is implied by this architecture change.
- Shared packages are planned under `packages/` for domain rules, TypeScript types, validation, API contracts, and platform-neutral API clients. Extract them only when real duplication or stable boundaries are identified; do not share React DOM UI components with React Native.
- Architecture style: modular monolith with explicit domains: identity, profiles, apps, testing, cohorts, assignments, feedback, economy, subscriptions, trust/safety, and notifications. Domain logic and contracts may be shared; web and native UI remain platform-specific.
- Vercel builds the web workspace from the monorepo. npm workspace scripts are defined at the repository root.
- Zustand and TanStack Query are not currently installed; evaluate them as a separate implementation decision rather than documenting them as existing dependencies.

Current repository state: `apps/web/` exists; `apps/mobile/` and shared packages do not exist yet.

### V1 scope

- Authentication and profiles
- Apps and testing cycles
- Cohorts, assignments, daily check-ins, feedback, and reviews
- Earned-points and purchased-credit wallets
- Configurable subscriptions, plans, and payments
- Admin operations and trust/safety review
- PWA delivery

Out of scope for V1: iOS/web app testing, public API, standalone marketplace, browser extension, Play Console API integration, and real-time chat.

## Roles

Guest, Tester, Developer, Both, Admin, Support. A user may have multiple roles. Authorization roles are backend-managed and never editable through client profile updates. Do not trust user_metadata for authorization.

## Binding business rules

### Google Play and assignment completion

- An assignment is completed only after 14 consecutive calendar days from its start date.
- It requires one successful TestDZ check-in on every day: 14/14.
- Any missed day or withdrawal fails that assignment, except a documented medical excuse approved by an administrator. An approved exception extends the assignment day-by-day and is fully audited.
- Feedback must be submitted.
- Developer confirmation is required, or the assignment is auto-validated after 7 days under the configured validation process.
- TestDZ check-ins are not proof of Google Play opt-in. Track Play opt-in evidence, withdrawal, and return separately. Never claim that TestDZ alone guarantees Google Play eligibility.

### Trust and safety

- Fraud score >=60: add to the review queue.
- Fraud score >=80: high-priority review with a 24-hour SLA.
- Never automatically ban or suspend, even at score 100.
- Suspension requires an explicit administrator action through a controlled `suspend_user` operation, an audit record, user notification, and an appeal window of 7 days.
- IP and device signals are probabilistic, not proof.

### Wallets and ledger

- `earned_points` and `purchased_credits` are distinct balances with distinct purposes.
- Earned points are earned through verified platform activity and may become eligible for cash withdrawal only under an administrator-configured conversion policy; the point-to-currency rate must not be hard-coded.
- `purchased_credits` remain a separate, non-withdrawable balance used only for configurable platform services.
- Cash withdrawal is a planned capability, not an active production workflow until request creation, admin review, payout reconciliation, and secure ledger reservation/release operations are implemented and tested.
- Each request must snapshot its conversion rate and currency at submission; later configuration changes must not alter an existing request.
- Withdrawal lifecycle: submitted → under_review → processing → completed, with rejected/cancelled paths and audited status transitions. Reserve points atomically; completion consumes them, while rejection/cancellation releases them atomically.
- Purchased credits are purchased in DZD and spent on configurable platform services.
- All wallet operations use atomic, idempotent server-side operations, row locking, and a unique idempotency key.
- Ledger is append-only. Corrections use reversal entries; no direct update/delete.
- Clients cannot mint points, change balances, or write ledger entries directly.

### Subscriptions and payments

- `subscriptions` is the source of truth. A profile tier field, if present, is a non-authoritative cache.
- Only one current subscription per user across active, trialing, and past_due states.
- Renewal updates the current period; transitions are idempotent and audited.
- Payment activation occurs only after a verified signed provider webhook. Browser redirects never activate a payment or subscription.
- Trials, referrals, and payments are disabled by default.
- Refunds are a separate auditable workflow; administrator decision only until provider/legal policy is validated.

### Cohorts and tests

- APP is a stable entity; TEST is an individual testing cycle.
- Suggested minimum tester count defaults to 12 but remains configurable.
- Cohort priority can consider subscription priority, waiting time, and developer reputation.
- Test lifecycle: recruiting, ready, running, at_risk, completed, failed, cancelled.
- Assignment lifecycle: pending, active, completed, withdrawn, failed, rejected.
- A tester interruption fails that tester's assignment; replacement does not restore the original tester's continuous duration.
- Never promise a guaranteed tester count.

### Configurability

Plans, prices, limits, rewards, cohort sizes, and thresholds belong in database configuration, not hard-coded business logic. Every configuration change must be audited.

Initial configurable proposals (not final commercial commitments):
- Assignment completion reward: 50 points
- Detailed quality-approved feedback: 10 points
- Daily check-in: 2 points, capped at 14 per test
- Verified signup: 10 points
- Referral after first completed test: 15 points
- Credit packages: 100 DZD / 200 credits; 500 DZD / 900 credits; 1500 DZD / 2400 credits; 5000 DZD / 7000 credits
- Daily points cap: 200
- Referrals: 5 per month
- Check-ins: 20 per day/IP
- Points expiry: 365 days

These are seed proposals only. Keep them configurable and validate them before enabling commerce.

## Security architecture

- Enable RLS on every table exposed through the Supabase API.
- Apply explicit GRANTs and RLS policies together; RLS alone is not the complete API security boundary.
- Keep internal tables and SECURITY DEFINER functions in a non-exposed schema.
- SECURITY DEFINER functions must use a fixed safe search_path and narrowly scoped EXECUTE grants.
- No direct client writes to ledger, payments, subscriptions, role assignments, or platform configuration.
- Protected fields include role, subscription_tier, is_verified, and is_banned. Client API must not update them.
- Never use user_metadata as an authorization source.
- Keep secret/service-role keys server-side and out of source control.
- Audit privileged actions and configuration changes.

## Core entities

profiles, user_roles, apps, tests, cohorts, assignments, checkins, feedback, play_opt_in_events, wallets, points_ledger, plans, subscriptions, payments, refunds, platform_config, audit_logs, fraud_reviews, reports, disputes, notifications.

## Roadmap

0. Architecture and threat model
1. Database schema and access policies
2. Auth and profiles
3. Apps CRUD
4. Testing engine and 14-day assignment rules
5. Cohorts and assignment
6. Wallet and ledger RPCs
7. Subscriptions
8. Payment gateway integration
9. Developer UI
10. Tester UI
11. Admin dashboard
12. Trust and safety
13. Notifications
14. PWA and deployment
15. Private beta

## Non-goals and guardrails

- No guarantee that any test or tester cohort satisfies Google Play requirements.
- No auto-suspension based on fraud score, IP, or fingerprint.
- No mock production data.
- No integration with or changes to the separate Achrili project.
