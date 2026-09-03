-- [DB-SAFETY] MUTATING — contains UPDATE/DELETE/DROP/ALTER/TRUNCATE/INSERT. Review carefully before running manually via DBeaver. Auto-labeled 2026-09-02 by check-sql-label.sh.

-- ===========================================================================
-- Application Form module -- schema for human-resource-management
-- Target: VOS Dummy (the MySQL database Directus 100.110.197.61:8056 fronts)
-- Run in DBeaver. Then register the collections/fields in Directus and
-- reconcile the schema cache (notes at the bottom).
-- ===========================================================================
--
-- BEFORE RUNNING:
--   Run:  SHOW CREATE TABLE applicant;
--   Confirm `id` is `int unsigned`. If it is plain signed `int`, remove UNSIGNED
--   from every *_id column below -- MySQL requires an FK column to be the exact
--   same type as the column it references, or it errors with errno 150.
--
-- CONVENTIONS:
--   - InnoDB + utf8mb4 (FKs require InnoDB).
--   - ENUM values capitalized to match manpower_request.status. The lists are
--     APPEND-ONLY from here: add new values at the END, never reorder or remove
--     (append-at-end is a cheap metadata change; anything else rebuilds the table).
--   - File columns (photo_file, signature_file, file) are CHAR(36) Directus file
--     UUIDs -- after running this, set their Directus field interface to "File".
--   - created_by / updated_by are plain app user ids (matches `applicant`), no FK.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. applicant  (EXISTS -- add the normalized-name search helper only)
-- ---------------------------------------------------------------------------
ALTER TABLE applicant
  ADD COLUMN name_normalized VARCHAR(255)
    GENERATED ALWAYS AS (LOWER(TRIM(full_name))) STORED
    AFTER full_name,
  ADD INDEX idx_applicant_name_normalized (name_normalized);


-- ---------------------------------------------------------------------------
-- 2. application  (NEW -- one submitted employment application; applicant 1:many)
-- ---------------------------------------------------------------------------
CREATE TABLE application (
  id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  applicant_id                INT UNSIGNED NOT NULL,

  -- Application Details
  position_applied_for        VARCHAR(255) NULL,
  how_heard                   ENUM('Walk-In','Advertisement','Friend/Family','MEN2 Employee','Other') NULL,
  how_heard_other             VARCHAR(255) NULL,

  -- Personal Information
  first_name                  VARCHAR(100) NULL,
  middle_name                 VARCHAR(100) NULL,
  last_name                   VARCHAR(100) NULL,
  nickname                    VARCHAR(100) NULL,
  address                     TEXT NULL,
  phone                       VARCHAR(50) NULL,
  email                       VARCHAR(255) NULL,
  birthdate                   DATE NULL,
  birthplace                  VARCHAR(255) NULL,
  sex                         ENUM('Male','Female') NULL,
  height_cm                   DECIMAL(5,2) NULL,
  weight_kg                   DECIMAL(5,2) NULL,
  civil_status                ENUM('Single','Married','Widowed','Separated','Divorced') NULL,
  religion                    VARCHAR(100) NULL,
  sss_no                      VARCHAR(30) NULL,
  tin                         VARCHAR(30) NULL,
  philhealth_no               VARCHAR(30) NULL,
  pagibig_no                  VARCHAR(30) NULL,
  drivers_license_no          VARCHAR(30) NULL,

  -- Skills / Other Information (free-text on the paper form)
  special_skills              TEXT NULL,
  languages                   TEXT NULL,
  organizational_affiliations TEXT NULL,
  hobbies_interests           TEXT NULL,

  -- Family Background gate
  has_company_relatives       TINYINT(1) NOT NULL DEFAULT 0,

  -- Certification
  certification_agreed        TINYINT(1) NOT NULL DEFAULT 0,
  certification_text_snapshot TEXT NULL,
  certification_signed_at     DATETIME NULL,
  signature_file              CHAR(36) NULL,

  -- Photo
  photo_file                  CHAR(36) NULL,

  -- Meta / workflow
  status                      ENUM(
                                'Draft','Submitted','Quiz Completed','Initial Interview',
                                'Verdict Pending','For Scheduling','Scheduled','For Job Offer',
                                'Job Offer Approved','Offer Signed','For Requirements',
                                'Hired','Rejected','Withdrawn','Talent Pool'
                              ) NOT NULL DEFAULT 'Submitted',
  source                      VARCHAR(50) NOT NULL DEFAULT 'hrm-assisted',
  submitted_at                DATETIME NULL,
  notes                       TEXT NULL,
  extra_data                  JSON NULL,

  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                  INT NULL,   -- signed, matches applicant.created_by; no FK
  updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by                  INT NULL,

  PRIMARY KEY (id),
  INDEX idx_application_applicant (applicant_id),
  INDEX idx_application_status (status),
  INDEX idx_application_submitted_at (submitted_at),
  CONSTRAINT fk_application_applicant
    FOREIGN KEY (applicant_id) REFERENCES applicant (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ---------------------------------------------------------------------------
-- Child tables  (all: id PK, application_id -> application FK CASCADE, sort)
-- ---------------------------------------------------------------------------

-- 3. Family Background: parents / spouse / siblings / children / dependents
CREATE TABLE application_family_member (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  relation       ENUM('Father','Mother','Spouse','Sibling','Child','Dependent') NOT NULL,
  name           VARCHAR(255) NULL,
  age            INT NULL,
  occupation     VARCHAR(255) NULL,
  company        VARCHAR(255) NULL,
  education      VARCHAR(255) NULL,   -- child/dependent "Education / Occupation"
  sort           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_afm_application (application_id),
  CONSTRAINT fk_afm_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Friends / relatives who work at MEN2
CREATE TABLE application_company_relative (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id  INT UNSIGNED NOT NULL,
  name            VARCHAR(255) NULL,
  relationship    VARCHAR(100) NULL,
  position        VARCHAR(255) NULL,
  area_assignment VARCHAR(255) NULL,
  sort            INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_acr_application (application_id),
  CONSTRAINT fk_acr_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Educational Background
CREATE TABLE application_education (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id      INT UNSIGNED NOT NULL,
  level               ENUM('Elementary','High School','Senior High School','Vocational','College','Post-Graduate') NOT NULL,
  school_name         VARCHAR(255) NULL,
  school_address      VARCHAR(255) NULL,
  date_from           VARCHAR(100) NULL,   -- loose: "SY 2018-2019", "June 2020"
  date_to             VARCHAR(100) NULL,
  degree_units_earned VARCHAR(255) NULL,
  honors_awards       VARCHAR(255) NULL,
  sort                INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_aed_application (application_id),
  CONSTRAINT fk_aed_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Work Experience
CREATE TABLE application_work_experience (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id     INT UNSIGNED NOT NULL,
  employer           VARCHAR(255) NULL,
  address            VARCHAR(255) NULL,
  job_title          VARCHAR(255) NULL,
  date_from          VARCHAR(100) NULL,
  date_to            VARCHAR(100) NULL,
  salary_rate_start  DECIMAL(12,2) NULL,
  salary_rate_end    DECIMAL(12,2) NULL,
  supervisor_name    VARCHAR(255) NULL,
  supervisor_contact VARCHAR(100) NULL,
  responsibilities   TEXT NULL,
  reason_for_leaving VARCHAR(255) NULL,
  sort               INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_awe_application (application_id),
  CONSTRAINT fk_awe_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Professional / Business References (no family members)
CREATE TABLE application_reference (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id       INT UNSIGNED NOT NULL,
  name                 VARCHAR(255) NULL,
  title_occupation     VARCHAR(255) NULL,
  company_name_address VARCHAR(255) NULL,
  contact_number       VARCHAR(100) NULL,
  sort                 INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_aref_application (application_id),
  CONSTRAINT fk_aref_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. Trainings / Seminars Attended
CREATE TABLE application_training (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  title_subject  VARCHAR(255) NULL,
  venue_location VARCHAR(255) NULL,
  date_from      VARCHAR(100) NULL,
  date_to        VARCHAR(100) NULL,
  sort           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_atr_application (application_id),
  CONSTRAINT fk_atr_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9. Board / Licensure Examinations Taken
CREATE TABLE application_licensure_exam (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id  INT UNSIGNED NOT NULL,
  examination     VARCHAR(255) NULL,
  date_taken      VARCHAR(100) NULL,
  rating          VARCHAR(50) NULL,
  result          VARCHAR(50) NULL,   -- Passed / Failed / etc (free text)
  inclusive_dates VARCHAR(100) NULL,
  sort            INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_ale_application (application_id),
  CONSTRAINT fk_ale_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10. Attachments (resume + future docs)
CREATE TABLE application_attachment (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  type           ENUM('Resume','Transcript','Government ID','Certificate','Other') NOT NULL DEFAULT 'Resume',
  file           CHAR(36) NULL,
  label          VARCHAR(255) NULL,
  uploaded_at    DATETIME NULL,
  sort           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_aat_application (application_id),
  CONSTRAINT fk_aat_application
    FOREIGN KEY (application_id) REFERENCES application (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ===========================================================================
-- AFTER RUNNING -- Directus
-- ===========================================================================
-- 1. Register each new table as a Directus collection (Settings > Data Model,
--    or PATCH /collections/<name> for an already-existing raw table -- same
--    trick used for the quiz tables).
-- 2. Field interfaces:
--      photo_file / signature_file / application_attachment.file  -> File
--      how_heard / sex / civil_status / status / level / relation / type -> Select Dropdown
-- 3. Build the relations in Directus so nested editors work:
--      applicant  1--*  application
--      application  1--*  each application_* child
-- 4. Reconcile the schema cache: POST /utils/cache/clear a few times, or a
--    deliberately-failing POST /fields nudge, or restart the Directus
--    container (the guaranteed fix -- lesson 275).
-- ===========================================================================
