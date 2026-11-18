# Google Play publishing — integration readiness audit

**Status:** verified readiness audit and implementation boundary only. No Google Play API credentials, OAuth connection, release job, upload, or publishing action is configured in this branch. This document is deliberately separate from TestDZ's internal app moderation and tester APK distribution.

## Verified current TestDZ baseline

- `DeveloperAddAppPage` collects app name, Android package ID, description, and category. It creates a TestDZ app draft; it does not connect a Google account or publish to Google Play.
- The V2 `apps` model contains `package_name`, `play_store_url`, `distribution_method`, and `distribution_url`. Its statuses (`draft`, `submitted`, `published`, `paused`, `archived`, `rejected`) describe TestDZ's own app review/lifecycle. In particular, TestDZ status `published` is not proof that Google Play has published a release.
- The six-step wizard validates a `googlePlay` configuration object containing `track`, `testerMethod`, `appVersion`, `releaseMode`, and `releaseAt`. These are saved test-planning settings only; the validator does not call Google Play.
- `test_builds` is the private TestDZ artifact workflow used to make a tester build available after enrollment. It is not a Google Play Publishing API upload.
- The inspected candidate tree contains no Google Play connection table, Android Publisher OAuth flow, service-account adapter, Google Play release Edge Function, release-job queue, or signed webhook handler.

## Official Google Play API requirements

- Google requires API access to be configured in Google Cloud and Google Play Console. Its Getting Started guide recommends a service account for most server-to-server integrations and requires the account to be granted the appropriate Play Console access. Credentials must remain in a secure server environment: [Google Play Developer API — Getting Started](https://developers.google.com/android-publisher/getting_started).
- Publishing uses transactional **edits**. The API workflow creates an edit, uploads the artifact, updates a track/release, and commits the edit. Changes do not become live until the edit is committed: [Google Play Developer API — Edits](https://developers.google.com/android-publisher/edits).
- Track releases have explicit states such as `draft`, `inProgress`, `halted`, and `completed`; staged rollout uses a user fraction. Track updates are part of an edit: [Tracks and releases](https://developers.google.com/android-publisher/tracks) and [edits.tracks resource](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks).

## Required architecture before implementation

1. **Connection ownership.** A Developer must explicitly connect or authorize a Google Play account. Verify that the connected account can access the exact package name. Do not infer ownership from a package string or a pasted Play Store URL.
2. **Server-side credentials only.** Never put service-account JSON, private keys, refresh tokens, or Android Publisher access tokens in browser code, `localStorage`, public environment variables, test configuration, logs, or analytics. The frontend calls a JWT-verified Edge Function; the server obtains and refreshes Google access tokens.
3. **Tenant isolation.** A Developer can operate only on apps they own in TestDZ and Google Play accounts they explicitly connected. An Admin may review audit records but must not silently inherit a Developer's Google credentials.
4. **Separate release records.** Use a dedicated release-job model rather than overloading `apps.status`, `play_store_url`, `distribution_url`, or the six-step wizard's `googlePlay` JSON. Track TestDZ review state separately from Google Play edit/release state.
5. **Idempotent release workflow.** Persist a unique request/idempotency key, app/package, artifact identity and checksum, version code, target track, release notes, rollout fraction, Google edit ID, status, timestamps, actor, and sanitized error code. Prevent duplicate commits and concurrent conflicting edits for the same package/track.
6. **Validate before upload.** Verify package-name ownership, artifact type/size/checksum, version-code monotonicity, track allowlist, release notes, rollout fraction, and app-specific permissions. Do not trust package name, version code, or artifact path supplied only by the browser.
7. **Two-stage commit.** Prepare and validate the Google Play edit first. Show the exact package, artifact/version, track, rollout percentage, and release notes to the Developer. Require an explicit final confirmation before the server commits the edit. Production rollout should have a stronger approval policy than an internal/closed test track.
8. **Lifecycle and recovery.** Record Google response IDs and sanitized errors. Support status refresh, safe retry, staged-rollout halt/resume where permitted, and reconciliation when a request times out after Google may have accepted the commit. Never claim success based only on an HTTP request being sent.
9. **Audit and privacy.** Log actor, app, target track, action, reason, result, and provider correlation ID. Never log credentials, access tokens, private keys, full request bodies containing sensitive metadata, or raw uploaded artifacts.

## Staged implementation plan

- **Stage A — readiness UI:** read-only display of whether an app is eligible for Play connection, its package ID, TestDZ review status, and whether a Play integration is configured. No fake Connect/Publish buttons.
- **Stage B — account connection:** implement the selected service-account or OAuth model, server-only credential storage, ownership verification, and disconnect/revoke flow.
- **Stage C — draft release:** create a release job, validate the app/artifact/version, create a Google edit, upload the artifact, and prepare a non-live draft release.
- **Stage D — confirmed rollout:** show a review screen and require explicit confirmation before committing an edit. Start with internal/closed testing; add production rollout only after security and recovery tests pass.
- **Stage E — monitoring:** refresh release state, show provider-confirmed results, and support safe staged-rollout recovery.

## External prerequisites needed to proceed

- A Google Play Console developer account and the exact package name of an app the connecting account controls.
- A Google Cloud project with the Google Play Developer API enabled.
- A service account or approved OAuth client, with the minimum required Play Console permissions granted to the target app.
- A decision on the multi-tenant credential model (per-Developer OAuth versus a platform service account explicitly invited to each participating Play Console account).
- Approval to configure server-side secrets and deploy the Edge Function after local tests pass.

## Explicit safety boundary

Until the external prerequisites and credential model are supplied and approved, TestDZ must not claim Google Play is connected, create an API edit, upload a production artifact, or publish a release. The current wizard's `googlePlay` fields remain planning metadata only. No hosted Supabase changes, Google API calls, secrets, release commits, or production deployments are part of this audit.
