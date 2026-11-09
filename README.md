# TestDZ

TestDZ is an Algeria-first platform that helps Android developers organize closed-testing cohorts and helps testers participate, check in, and submit useful feedback.

## Project status

- Phase: active implementation and architecture refactoring; not launch-ready.
- Repository: private.
- Web client: React + TypeScript + Vite in `apps/web/`, with React Router and PWA configuration.
- Mobile client: React Native + Expo is planned under `apps/mobile/`; it has not been created yet.
- Backend: dedicated Supabase project.
- Database region: eu-west-3 (Paris).
- Payments, trials, and referrals: disabled by default until their workflows are implemented and verified.

## Documentation

- [Master Blueprint v2.0](docs/MASTER_BLUEPRINT.md) — canonical product, architecture, data and implementation reference.
- [Architecture notes](docs/ARCHITECTURE.md) — approved target architecture and technical guardrails.

## Core principles

1. TestDZ check-ins do not prove Google Play's continuous opt-in requirement.
2. Assignment completion is designed around 14 consecutive calendar days and 14/14 daily check-ins. The medical-exception rule remains an implementation gate until the conflicting approved policies are reconciled.
3. Earned points and purchased credits are separate balances and ledgers.
4. Subscription records are authoritative; profile tier fields are cache only.
5. Payments activate only after a verified, signed, idempotently processed provider webhook.
6. Fraud signals create review work; they never automatically suspend users.
7. Every exposed table is protected with explicit grants and Row Level Security.
8. No production mock data. Demo data must be clearly marked and isolated.

## Repository layout

```
apps/
  web/                 React + TypeScript + Vite web client
  mobile/              planned React Native + Expo client
packages/              planned platform-neutral shared packages
docs/
  ARCHITECTURE.md
  MASTER_BLUEPRINT.md
supabase/
  migrations/
```

The mobile app and shared packages are planned architecture targets, not implemented directories. The existing Supabase configuration and migrations remain at the repository root.

## Supabase project

Use the dedicated TestDZ Supabase project only. Never point this repository at Achrili or reuse Achrili credentials.

Project ref: `naqjjykcglxiobkmdllj`

The publishable key may be used by a client app. Secret/service-role credentials must remain server-side and must never be committed.

## Current implementation status

- Supabase foundation: 8 migrations applied; 28 public tables with RLS enabled (recorded project status; re-check before any production decision).
- RLS: 38 policies (recorded project status; re-check after schema changes).
- Plan catalog: Free, Plus and Pro seeded with draft DZD prices.
- Web client: existing React + TypeScript + Vite application and initial PWA configuration.
- Monorepo: npm workspace root configured for `apps/web`.
- Mobile app and shared packages: planned, not yet created.
- Trial and payment activation remain disabled until their workflows are implemented and verified.

See [the execution tracker](docs/MASTER_BLUEPRINT.md#15-execution-tracker--operational-plan) for completed work and next milestones.

## Run the web client locally

From the repository root:

```bash
npm install
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the web app's local environment file before testing Supabase-connected flows. Only the Supabase publishable key belongs in the browser. Never put a secret/service-role key in any `VITE_` variable.

## Development workflow

- Review each migration before applying it.
- Keep migration files in chronological order.
- Apply migrations only to the TestDZ project.
- Run Supabase security/performance advisors after schema changes.
- Keep all business prices, plan limits, rewards, and thresholds configurable in database configuration rather than hard-coded in application code.
- Keep web and native UI platform-specific; share only stable, platform-neutral domain logic, types, validation, contracts, and API behavior.
