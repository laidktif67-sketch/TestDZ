# Week 3 — Apps CRUD

## Implemented
- Authenticated app list and detail routes: `/apps` and `/apps/:id`.
- Create form with name, package ID, description, category and optional icon.
- Client-side image compression for avatars and app icons.
- Edit, soft archive and restore.
- Plan limit summary RPC and database-enforced create/restore limits.
- App icon Storage bucket with owner-folder write policies.
- Global case-insensitive package ID uniqueness.

## Applied migrations
- `20261106001300_apps_crud_storage_and_plan_limits.sql`
- `20261106001400_app_limit_read_rpc.sql`
- `20261106001500_harden_app_validation.sql`

All three migrations are applied to the dedicated TestDZ Supabase project. The latest Supabase Security Advisor result contains no findings.

## Implementation notes
- New apps start as `draft`; this does not publish to Google Play.
- Database RPCs enforce plan limits and serialize concurrent create/restore requests per user.
- App mutations are exposed through authenticated invoker RPC wrappers and private helper functions.
- Archived package IDs remain reserved.
- The app icon bucket accepts PNG/JPEG and has a 512,000-byte upload limit.

## Acceptance tests still required
- Real signed-in developer create/edit/archive/restore flow.
- Cross-user RLS and Storage isolation.
- Free and Plus plan-limit end-to-end tests.
- Mobile visual and accessibility checks.
- Hosted SMTP, redirect URL and signup/verify/reset verification from Week 2.5.

Do not mark Week 3 complete until the authenticated acceptance tests pass.