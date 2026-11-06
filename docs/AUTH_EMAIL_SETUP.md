# TestDZ — Auth and email setup

## Local development (Mailpit)

The repository's `supabase/config.toml` configures local Auth to send confirmation and password-reset messages to Mailpit.

1. Install Docker and Supabase CLI.
2. From the repository root, run `supabase start`.
3. Start Mailpit on the host:
   `docker run --rm -d --name testdz-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`
4. Start the frontend with the local Supabase URL and publishable key in `frontend/.env.local`.
5. Register a test user and open [Mailpit](http://localhost:8025).
6. Open the confirmation link. It should return to `/auth/callback` and then route to onboarding.
7. Request password reset. The message should arrive in Mailpit and return to `/reset-password`.

If Supabase Auth runs in Docker on a platform where `host.docker.internal` is unavailable, use the host gateway address reachable from the Supabase Auth container. Do not expose Mailpit to the public internet.

## Hosted Supabase project

The local TOML file does not change hosted project Auth settings or SMTP credentials.

Project: `naqjjykcglxiobkmdllj`

In Supabase Dashboard → Authentication → URL Configuration, set the development Site URL to the actual frontend dev origin while testing. Add these allowed redirects:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`

Before production, replace/add the verified production origin:

- `https://YOUR_VERIFIED_DOMAIN/auth/callback`
- `https://YOUR_VERIFIED_DOMAIN/reset-password`

Do not use `testdz.app` until the domain is registered and DNS/ownership are verified. Set the hosted Site URL to the real production URL only at launch.

In Authentication → SMTP Settings, configure a real transactional SMTP provider (planned: Resend). Store its SMTP credentials only in Supabase's secret settings. Never commit SMTP credentials, API keys, service-role keys, or `.env.local`.

## Manual acceptance test (hosted Auth)

Use a new email address you control:

1. Sign up. Confirm that `auth.users` is created and a corresponding `profiles`, `user_roles`, and `wallets` record appears.
2. Verify that the confirmation email arrives; open it and check the callback route.
3. Complete onboarding as Tester, Developer, and Both using separate test accounts.
4. Sign out and sign in again.
5. Request password reset; open the email and set a new password.
6. Confirm the old password no longer works and the new one does.
7. Edit profile fields and upload an avatar.
8. Attempt to change role / verification / subscription fields through the client; the database must reject the attempt.

Do not mark hosted email delivery or the end-to-end auth debt complete until these tests pass against the hosted project.
