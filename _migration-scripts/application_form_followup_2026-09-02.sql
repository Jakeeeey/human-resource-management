-- [DB-SAFETY] MUTATING — contains UPDATE/DELETE/DROP/ALTER/TRUNCATE/INSERT. Review carefully before running manually via DBeaver. Auto-labeled 2026-09-02 by check-sql-label.sh.

-- ===========================================================================
-- Application Form -- follow-up ALTERs to application_form_2026-09-02.sql
-- Run AFTER that script, in DBeaver, against VOS Dummy. Tables are still empty
-- (except the APPFORM DEMO row), so the ENUM reorder in (2) is free.
-- ===========================================================================

-- (2) Add "Final Interview" to the pipeline, in its logical position (between
--     Initial Interview and Verdict Pending). A mid-list ENUM change rebuilds
--     the table -- fine while it's empty; append-only is the rule once there's
--     real data.
ALTER TABLE application
  MODIFY COLUMN status ENUM(
    'Draft','Submitted','Quiz Completed','Initial Interview','Final Interview',
    'Verdict Pending','For Scheduling','Scheduled','For Job Offer',
    'Job Offer Approved','Offer Signed','For Requirements',
    'Hired','Rejected','Withdrawn','Talent Pool'
  ) NOT NULL DEFAULT 'Submitted';

-- (3) Denormalized quiz result on the application, for the future HR list view
--     (shows the result without a join). Written at quiz completion; the
--     quiz_attempt row stays the source of truth.
ALTER TABLE application
  ADD COLUMN quiz_score  INT NULL AFTER submitted_at,
  ADD COLUMN quiz_passed TINYINT(1) NULL AFTER quiz_score;

-- (1) Tie a quiz attempt to the specific application, not just the applicant.
--     BEFORE RUNNING: SHOW CREATE TABLE quiz_attempt;  confirm applicant_id is
--     `int unsigned`. If it is plain signed `int`, drop UNSIGNED below so the
--     FK column type matches application.id (errno 150 otherwise).
--     ON DELETE SET NULL: deleting an application keeps the attempt history,
--     it just loses the application link (the applicant link is unaffected).
ALTER TABLE quiz_attempt
  ADD COLUMN application_id INT UNSIGNED NULL AFTER applicant_id,
  ADD INDEX idx_quiz_attempt_application (application_id),
  ADD CONSTRAINT fk_quiz_attempt_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- AFTER RUNNING -- Directus
--   - POST /utils/cache/clear (a few times, or restart the container).
--   - application.status : if the dropdown doesn't show "Final Interview",
--     refresh the field's options in Data Model, or restart the container.
--   - application.quiz_score / quiz_passed : should appear on cache reconcile;
--     set quiz_passed's interface to Boolean.
--   - quiz_attempt.application_id : register the field + a M2O relation to
--     `application` (mirror the existing quiz_attempt.applicant_id relation).
-- ===========================================================================
