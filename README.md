# TestDZ

TestDZ is an Algeria-first platform that helps Android developers organize closed-testing cohorts and helps testers participate, check in, and submit useful feedback.

## Project status

- Phase: foundation / database + auth bootstrap
- Repository: private
- Backend: dedicated Supabase project
- Database region: eu-west-3 (Paris)
- Frontend: not scaffolded yet
- Payments: disabled by default
- Trials and referrals: disabled by default

## Documentation

- [Master Blueprint v2.0](docs/MASTER_BLUEPRINT.md) — canonical product, architecture, data and implementation reference.
- [Architecture notes](docs/ARCHITECTURE.md) — concise technical guardrails.

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
supabase/
  migrations/
```

## Supabase project

Use the dedicated TestDZ Supabase project only. Never point this repository at Achrili or reuse Achrili credentials.

Project ref: `naqjjykcglxiobkmdllj`

The publishable key may be used by a client app. Secret/service-role credentials must remain server-side and must never be committed.

## Development workflow

- Review each migration before applying it.
- Keep migration files in chronological order.
- Apply migrations only to the TestDZ project.
- Run Supabase security/performance advisors after schema changes.
- Keep all business prices, plan limits, rewards, and thresholds configurable in database configuration rather than hard-coded in application code.
