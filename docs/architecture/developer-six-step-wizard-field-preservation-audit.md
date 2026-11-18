# Six-Step Developer Test Wizard — Field Preservation and Contract Audit

**Audit date:** 2026-11-18  
**Reference head:** `8d79d3154efe6284a8d91dbaeca7b5690e469758` (PR #107)  
**Legacy UI reference:** `feat/developer-create-test-six-step`  
**Current UI:** `apps/web/src/modules/developer/pages/DeveloperCreateTestSixStepPage.tsx`  
**Current API:** `apps/web/src/features/apps/apps-api.ts`  
**Candidate contract:** `supabase/rebuild-v2/029_six_step_test_config.sql` and `supabase/rebuild-v2/tests/025_six_step_test_config_contract.sql`

## Scope and safety

This is a repository-only field and contract review. It changes no application code, SQL, migrations, hosted Supabase, Auth, Storage, secrets, Edge Functions, or deployments. It does not apply candidate migration 029 anywhere.

## Executive finding

The current V2 wizard retains the useful structured fields from the legacy six-step form and sends an allowlisted configuration through `create_test_with_config`. The API type, candidate SQL validator, and contract test deliberately exclude raw `googleGroup` and `testerEmails` values. CSV addresses and the Google Group address therefore remain local form state; the saved configuration keeps the selected tester method but not the address list or group identifier. This is a privacy-preserving boundary and must not be “fixed” by persisting raw contact lists.

The configuration is a planning record. It does not publish to Google Play, send invitations, upload a Play release, or recruit testers.

## Field-by-field persistence map

| Wizard field | Current persisted destination | Status / notes |
|---|---|---|
| Test type | `tests.test_type` | Persisted as a typed test field. |
| Selected app | `tests.app_id` | Persisted; creation RPC must verify app ownership and eligible state. |
| Title | `tests.title` | Persisted after client validation. |
| Description | `tests.description` | Persisted after client validation. |
| Target tester count | `tests.min_testers` and `test_config.cohort.targetTesters` | Intentionally duplicated; SQL rejects mismatch. |
| Cohort notes | `test_config.cohort.notes` | Persisted, nullable and length-limited. |
| Android version rule | `test_config.rules.androidVersion` | Persisted as a bounded string. |
| Tester instructions | `tests.instructions` and `test_config.rules.instructions` | Intentionally duplicated; SQL rejects mismatch. |
| Testing objective | `test_config.details.testingObjective` | Persisted from the allowlist. |
| Priority | `test_config.details.priority` | Persisted as low / medium / high. |
| Testing scope | `test_config.details.testingScope` | Persisted as an allowlisted array; core flows, performance, compatibility and accessibility are the intended values. |
| Success criteria | `test_config.details.successCriteria` | Persisted, nullable and bounded. |
| Minimum completion rate | `test_config.details.minimumCompletionRate` | Persisted and bounded 1–100. |
| Duration preset | `test_config.schedule.durationDays` | 7 / 14 / 30 saved as a number. |
| Custom duration | `durationDays = null`; actual dates remain in `tests.start_date` and `tests.end_date` | The UI's explicit start/end date range is the source of truth for a custom period; no arbitrary day count is stored. |
| Allow more testers | `test_config.schedule.allowMoreTesters` | Persisted boolean. |
| Joining method | `test_config.schedule.joiningMethod` | Persisted as a planning choice only. |
| Collect feedback | `test_config.schedule.collectFeedback` | Persisted boolean. |
| Enable bug reports | `test_config.schedule.enableBugReports` | Persisted boolean. |
| Google Play track | `test_config.googlePlay.track` | Planning metadata only; no Publisher API call. |
| Tester method | `test_config.googlePlay.testerMethod` | Method only; no invitation or group membership action. |
| Google Group email | Not persisted | Kept local. Do not store without a separately approved, consented invitation design. |
| CSV tester emails | Not persisted | Parsed locally; never silently invite, upload, or persist raw addresses. |
| App version preference | `test_config.googlePlay.appVersion` | Planning metadata only; “latest available” is not verified against Play. |
| Release mode | `test_config.googlePlay.releaseMode` | Planning metadata only. |
| Planned release date/time | `test_config.googlePlay.releaseAt` | Planning metadata only; not a scheduled Play release. |

## Contract protections verified in source

- Configuration must be an object containing exactly the five expected top-level keys: `cohort`, `rules`, `details`, `schedule`, `googlePlay`.
- Each nested object rejects unknown keys and validates expected JSON types, enum values and bounds.
- Target tester count is constrained to 1–500 and must match `tests.min_testers`.
- Instructions are checked for consistency between the top-level test field and the rules object.
- Tester emails and Google Group addresses are intentionally absent from the server allowlist.
- The creation implementation checks the authenticated Developer/Admin role, delegates core creation to the V2 test creation implementation, saves the validated configuration on the same draft, and records an audit event.
- Contract coverage verifies successful draft persistence, target-count mismatch rejection, raw tester-email rejection without a partial draft, and denial for a Tester role.

These are source-level findings from the candidate files; this document does not claim the migration was applied to hosted Supabase.

## UX and product gaps to resolve

1. **Step helper copy is misaligned.** The current six-element helper-description array describes adding title/description on step 3, target testers on step 4, and dates/instructions on step 5. The actual UI sections place Google Play/configuration settings on step 3, test title/objective/scope on step 4, and target testers/scheduling/instructions on step 5. Update only the helper copy in a future UI change; do not rearrange or discard fields.
2. **Custom duration is date-defined.** Selecting “Custom duration” does not request a numeric day count; the user sets explicit start and end dates. Keep this behavior clear in the review summary. The backend stores those dates separately and stores a null duration preset.
3. **Google Play labels must remain honest.** Track, app version and release preference are TestDZ planning metadata. “Immediately” does not publish; “scheduled” does not create a Play release job. Keep the draft-only warning visible.
4. **Tester access options are not invitations.** Join link, Google Groups and CSV upload are configuration preferences. The secure invitation workflow in PR #105 is a separate manually shared link workflow; do not imply CSV or Google Group invitations were sent.
5. **Wizard persistence is draft-only.** The final action creates a TestDZ draft. Review submission is a separate server-side transition and must not be conflated with publishing or release commit.
6. **Cross-role and owner checks need browser verification.** Exercise the wizard as a Developer, then verify that another Developer cannot create against or mutate an app they do not own and that Tester/Support roles cannot invoke the creation RPC.

## Recommended next work

- Fix the step helper descriptions in a separate minimal UI PR after this audit.
- Add or confirm contract cases for invalid enum values, unknown nested keys, malformed dates, oversized strings, duplicate scope values, and mismatched instructions.
- Run the exact candidate SQL replay and contract on a disposable local database only, plus frontend typecheck/build and TestDZ CI.
- Complete manual browser testing for desktop, mobile, Arabic RTL, keyboard navigation and all loading/error/empty states.
- Keep Google Play integration, email delivery and invitation contact storage as separate explicitly approved workstreams.

## Safety boundary

- Preserve the existing form fields and their current server allowlist.
- Do not add raw tester emails or Google Group addresses to `test_config`.
- Do not apply candidate migrations to hosted Supabase, configure secrets, deploy Edge Functions, send email, publish to Google Play, or deploy Vercel as part of this audit.
- Keep all PRs Draft and unmerged until explicit user approval.
