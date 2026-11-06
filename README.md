# TestDZ

TestDZ is an Algeria-first platform that helps Android developers organize closed-testing cohorts and helps testers participate, check in, and submit useful feedback.

## Project status

- Phase: database foundation + initial React/Vite frontend
- Repository: private
- Backend: dedicated Supabase project
- Database region: eu-west-3 (Paris)
- Frontend: React + TypeScript + Vite application
- Payments: disabled by default
- Trials and referrals: disabled by default

## Documentation

- [Master Blueprint v2.0](docs/MASTER_BLUEPRINT.md) — canonical product, architecture, data and implementation reference.
- [Architecture notes](docs/ARCHITECTURE.md) — concise technical guardrails.\n- [Week 4 Design System](docs/WEEK_4_DESIGN_SYSTEM.md) — UI tokens, components, layout primitives and verification checklist.

## Core principles

1. TestDZ check-ins do not prove Google Play's continuous opt-in requirement.
2. Assignment completion is designed around 14 consecutive calendar days and 14/14 daily check-ins. The medical-exception rule is pending founder confirmation because the v2.0 blueprint conflicts with the earlier approved exception policy.
3. Earned points and purchased credits are separate balances and ledgers.
4. Subscription records are authoritative; profile tier fields are cache only.
5. Payments activate only after a verified, signed, idempotently processed provider webhook.
6. Fraud signals create review work; they never automatically suspend users.
7. Every exposed table is protected with explicit grants and Row Level Security.
8. No production mock data. Demo data must be clearly marked and isolated.

## Repository layout

```
docs/
  ARCHITECTURE.md
  MASTER_BLUEPRINT.md
frontend/
  React + TypeScript + Vite application
supabase/
  migrations/
```

## Supabase project

Use the dedicated TestDZ Supabase project only. Never point this repository at Achrili or reuse Achrili credentials.

Project ref: `naqjjykcglxiobkmdllj`

The publishable key may be used by a client app. Secret/service-role credentials must remain server-side and must never be committed.

## Week 2 progress

The current Auth/Profile slice includes signup/login, email confirmation callback and resend UI, password recovery/reset, role onboarding, profile editing, and avatar upload UI. Database migrations add email-confirmation synchronization, optional phone/interests, owner-scoped avatar storage, and a restricted onboarding RPC. These flows are implemented but still require live SMTP and end-to-end browser verification before launch.

## Current implementation status

- Supabase foundation: 8 migrations applied; 28 public tables with RLS enabled.
- RLS: 38 policies; latest Supabase security advisor check returned no findings.
- Plan catalog: Free, Plus and Pro seeded with draft DZD prices.
- Frontend: React + TypeScript + Vite baseline and initial PWA configuration.
- Trial and payment activation remain disabled until their workflows are implemented and verified.

See [the execution tracker](docs/MASTER_BLUEPRINT.md#15-execution-tracker--operational-plan) for completed work and next milestones.

## Run the frontend locally

```bash
cd frontend
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
npm install
npm run dev
```

Only the Supabase publishable key belongs in the browser. Never put a secret/service-role key in any `VITE_` variable.

## Development workflow

- Review each migration before applying it.
- Keep migration files in chronological order.
- Apply migrations only to the TestDZ project.
- Run Supabase security/performance advisors after schema changes.
- Keep all business prices, plan limits, rewards, and thresholds configurable in database configuration rather than hard-coded in application code.
