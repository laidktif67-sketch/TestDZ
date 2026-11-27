-- Bounded recovery for terminally failed developer review reminder delivery.
-- A reminder that cannot be delivered must never unlock automatic approval.
BEGIN;

ALTER TABLE rebuild_v2.assignment_submissions
  ADD CONSTRAINT assignment_submissions_reminder_delivery_retries_check
  CHECK (reminder_delivery_retries BETWEEN 0 AND 3);

COMMENT ON COLUMN rebuild_v2.assignment_submissions.reminder_delivery_retries IS
  'Number of replacement outbox events created after terminal reminder delivery failure; capped at three. A still-undelivered reminder remains fail-closed for automatic approval.';

COMMIT;
