# TestDZ-Rebuild Storage policy review — 2026-11-15

## Scope

Read-only catalog inspection of `storage.objects` RLS policies on isolated `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`). No Storage objects were uploaded, changed, or deleted. The legacy `TestDZ` project was not modified.

## Policy inventory reviewed

- `avatars`: authenticated users have owner-folder insert/select/update/delete policies.
- `app-icons`: authenticated users have owner-folder insert/update/delete policies; reads are public for the `app-icons` bucket.
- `support-attachments`: insert requires a UUID ticket folder, the current user as the second path segment, an open ticket, and requester-role/authorized support-staff participation. Reads are restricted to ticket participants or support staff.
- `developer-feedback-attachments`: insert requires a UUID feedback folder, the current user as the second path segment, and participation in the matching feedback item. Reads are limited to the tester or the developer associated with the feedback's assignment.

The corresponding relational attachment INSERT policies also bind the uploader to `auth.uid()`, enforce the expected storage-path pattern, and require the message author to match the current user.

## Findings and limits

1. The catalog definitions contain explicit ownership/participant checks for the reviewed private attachment buckets. The `app-icons` bucket is intentionally publicly readable according to its policy.
2. This was a **static policy review only**. No authenticated HTTP Storage upload/download/delete was performed. A SQL role/JWT simulation is not equivalent to a real Storage API request and cannot certify the complete Storage gateway path.
3. The test database is empty of representative feedback/ticket rows. Consequently, participant checks, path-to-record binding, closed-ticket denial, and cross-user access denial still need tests with fixture rows and separate real Auth identities.
4. Do not loosen policies merely to make a synthetic test pass. Keep the existing policies until a reproducible failing case demonstrates a defect.

## Overall gate

Storage behavioral validation remains pending. The four intentionally held migrations remain held. Do not merge, deploy, or declare production readiness on the basis of this catalog review.
