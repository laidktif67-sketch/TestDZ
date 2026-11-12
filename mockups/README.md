# TestDZ Mockup Reference

This branch is the central, branch-independent reference for TestDZ UI mockups.

## Purpose
- Keep approved screen mockups in one stable place.
- Let work branches consult the same reference without copying mockup files into every feature branch.
- Record screen names and design status so implementation can be compared against the approved design.

## Folder organization
Add the original mockup files under the folders below, preserving original filenames where practical:

- `auth/` — sign in, registration, password reset, onboarding
- `dashboard/` — tester dashboard and profile
- `assignments/` — assignment details, active progress, submission and feedback
- `rewards/` — wallet, points and reward redemption
- `support/` — help center, support tickets and live chat
- `shared/` — reusable states, navigation, dialogs and design references

## Rules
1. This branch is a reference source, not an application feature branch.
2. Do not merge this branch into `main` or feature branches just to view designs.
3. Feature branches should link to the relevant image in this branch in PR descriptions or task notes.
4. Update this reference when a mockup is approved; keep obsolete versions clearly labelled rather than silently overwriting a design.
5. Treat example values in mockups as illustrative unless explicitly marked as real.

## Current status
The repository was reviewed before setting up this reference. The separate local mockup folder has not yet been uploaded, so this branch currently contains the index only. Add the original ZIP's contents after reviewing its structure; do not assume the proposed categories above already exist in that ZIP.
