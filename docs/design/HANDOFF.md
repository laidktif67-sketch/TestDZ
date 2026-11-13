# Handoff — Wave 1

## Source and inventory
- Reference branch: `feat/developer-report-review`, PR #31, start SHA `c0ab024cbb11d95e698f4cd382e44abe8d216904`.
- Token source: `apps/web/src/styles/tokens.css`; fonts Plus Jakarta Sans / Noto Sans Arabic. HTML snapshots embed the existing tokens plus proposals listed in TOKEN_CHANGES.md.
- Entry point: `mockups/index.html`.
- Files: `shared-foundations-states-{ar,fr,en}.html`, `tester-assignment-checkin-states-{ar,fr,en}.html`, `tester-medical-exception-request-{ar,fr,en}.html`, `tester-wallet-points-states-{ar,fr,en}.html`, `shared-account-access-states-{ar,fr,en}.html`.

## Components and behavior
- M-00: SemanticStatus, Button, EmptyState, ErrorState, Skeleton, StateNotice.
- M-02: CheckInState. Server date is Africa/Algiers. No past/future dates, one check-in per assignment/day. TestDZ check-in is not proof of Google Play opt-in.
- M-03: MedicalExceptionForm collects selected dates + short reason only; no upload. Admin only decides. Tester’s developer cannot view the request. Privacy text remains placeholder pending legal counsel. Proposed 300-character limit requires backend alignment.
- M-05: Show earned, pending, and rejected rewards separately. Approved earned rewards may be converted to a cash withdrawal under the administrator-configured rate and eligibility rules. Purchased credits remain non-withdrawable. Never imply pending or rejected rewards are withdrawable.
- M-12: Offline, expired session, account restricted, no permission, not found are separate. Account restriction is shown even if the session still exists.

## Accessibility and responsive
- Mobile-first at 360×800; one column under 520px; centered max-width 720px for wider viewports.
- Buttons >=44px; fields 48px. Checkbox row hit area must be expanded to 44px in implementation.
- Focus ring uses existing 3px outline and 3px offset with `--color-focus`.
- Proposed semantic text contrast on white: success 5.37:1, warning 5.02:1, danger 6.57:1, info 6.72:1. Check every colored background and disabled state separately.
- Existing `--color-text-soft #7183a2` contrast is 3.84:1; not for normal text on white. Existing accent is 3.05:1 and danger is 4.22:1.
- Use semantic labels/headings and live regions for status feedback. Isolate Latin identifiers and emails in RTL contexts.

## Required implementation follow-up
1. Adopt semantic tokens centrally and migrate local colors; do not introduce feature-local colors.
2. Consolidate button states and 44px minimum across existing styles.
3. Implement shared state components with logical CSS properties.
4. Reconcile medical schema: current migration includes legacy `evidence_storage_path`; new UI must not upload evidence. Add API validation for short reason and selected dates.
5. Resolve check-in reward cap discrepancy: current migration in this branch returns 2 points per successful check-in, without the previously documented 14-award cap.
6. Verify pending/rejected point records and reasons exist before wiring M-05.
7. Preserve banned-account check before allowing protected app routes; do not confuse it with session expiry.

## Validation limits
Static standalone HTML only. No application runtime, browser screenshots, real device test, backend integration, screen-reader test, or native French proofreading was run. No files outside docs/design were modified. No image generation was used.


## Sample data note
Names, dates, balances, and ledger rows shown in the HTML are illustrative design data only. They are not live account data and must be replaced with API-backed values during implementation.


## Admin dashboard concept (added 2026-11-13)
- Preview entry: `mockups/admin-dashboard-overview-ar.html` (Arabic), plus French and English variants.
- This is a static responsive concept with illustrative values and non-functional navigation/action tiles.
- Scope represented: overview metrics, platform growth, test status, quick actions, pending admin queues, recent activity, community contributors and system overview.
- Future module links include payments, withdrawals, rewards, leaderboard and monitoring. These are mockup-only placeholders and must not be treated as implemented features.
- No files outside `docs/design/` were changed. No Admin route, source component, API, migration, or database object was added.
