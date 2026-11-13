# Component gaps — Wave 1

| Component | State/variant | Mobile specification | Tokens | Usage | RTL |
|---|---|---|---|---|---|
| SemanticStatus | success, warning, danger, info | full width; 12–16px padding | proposed semantic tokens | badges/notices | logical alignment |
| Button | default, hover, focus, disabled, loading | min-height 44px | primary, primary-hover, focus, radius-md | all actions | direction-neutral icon |
| EmptyState | icon, reason, one next action | 16px padding | surface/text/space | empty lists | align start |
| ErrorState | message, retry/recovery | 16px padding | danger semantic tokens | network/server/resource errors | localized action order |
| Skeleton | text/card/list row | match final component dimensions | surface-subtle/radius | loading content | direction-neutral; reduced motion |
| StateNotice | offline/session-expired/account-restricted/no-permission | full width | semantic status tokens | route guards | no unnecessary icon mirroring |
| CheckInState | available/recorded/missed/duplicate/rejected | CTA >=44px | buttons/status | assignment progress | isolate date values as needed |
| MedicalExceptionForm | date selection, short reason, privacy, pending | inputs 48px; checkbox target 44px | form/status tokens | tester progress | localize dates and direction |
| PointsDisclosure | balance + pending/earned/rejected ledger rows | 16px padding | text/surface/status | wallet/reward | mandatory non-cash phrase |
| AccountRestrictedNotice | banned account with active session | full width | danger tokens | AuthGuard | distinct from expired session |

## Implementation notes
- M-03 has no file upload. Existing migration still has legacy `evidence_storage_path`; reconcile separately. 300-character reason limit is a design proposal and needs matching API validation.
- The current check-in migration read on this branch awards 2 points per successful check-in and does not implement the previously discussed 14-reward cap. Resolve policy and SQL tests before shipping.
- M-05 status examples are illustrative. Confirm pending/rejected states are backed by the live ledger before wiring them.
