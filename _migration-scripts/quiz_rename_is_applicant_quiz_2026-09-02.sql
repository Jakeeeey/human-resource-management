-- [DB-SAFETY] MUTATING — contains UPDATE/DELETE/DROP/ALTER/TRUNCATE/INSERT. Review carefully before running manually via DBeaver. Auto-labeled 2026-09-02 by check-sql-label.sh.

-- ===========================================================================
-- Rename quiz.is_mobile_applicant_quiz -> is_applicant_quiz  (VOS Dummy)
-- The applicant flow runs in the HRM app, not a mobile app -- "mobile" is wrong.
-- Code is already renamed on branch mobile-applicant-quiz. Run in DBeaver.
-- ===========================================================================

-- 1. rename the column (keeps the data -- all values carry over)
ALTER TABLE quiz
  CHANGE COLUMN is_mobile_applicant_quiz is_applicant_quiz TINYINT(1) NOT NULL DEFAULT 0;

-- 2. realign Directus's own metadata row, if one exists (0 rows affected is fine
--    -- Directus re-introspects the column on the next cache clear either way)
UPDATE directus_fields
  SET field = 'is_applicant_quiz'
  WHERE collection = 'quiz' AND field = 'is_mobile_applicant_quiz';

-- ===========================================================================
-- AFTER RUNNING -- clear the Directus schema cache (PowerShell):
--
--   $h = @{ Authorization = "Bearer AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW" }
--   Invoke-RestMethod -Method Post -Uri "http://100.110.197.61:8056/utils/cache/clear" -Headers $h
--
-- Then confirm:
--   Invoke-RestMethod -Uri "http://100.110.197.61:8056/items/quiz?limit=1&fields=id,is_applicant_quiz" -Headers $h
--   -- should return the field with a 0/1 value, no error.
-- If it still errors, restart the Directus container (lesson 275).
-- ===========================================================================
