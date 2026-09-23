# Performance Evaluation → PIP → Regularization — DDL

Eight tables. Status: **applied and verified** against Directus (8/8 tables, zero column drift,
types confirmed, all three unique keys proven).

House rules honoured: snake_case; `INT AUTO_INCREMENT` PKs; audit columns
`created_by`/`updated_by` (`INT NULL`) and `created_at`/`updated_at` (`DATETIME NULL`) with **zero DB
defaults** — application code writes them as Philippine wall-clock `'YYYY-MM-DD HH:mm:ss'`.
No FOREIGN KEYs are declared (joins are code-only, deletes are manual ordered teardown).

## Tables

```sql
-- 1) KPI criteria library (admin-owned; the HR surface manages it)
CREATE TABLE `evaluation_criteria` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `kpi_category` VARCHAR(150) NOT NULL,
  `kpi_description` TEXT NOT NULL,
  `target` VARCHAR(255) NULL,
  `measurement_method` VARCHAR(255) NULL,
  `weight_percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_evaluation_criteria_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) PIP areas library (the Department-Head surface manages it)
CREATE TABLE `pip_criteria` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `area_name` VARCHAR(150) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_pip_criteria_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Per-employee lifecycle ledger — exactly one row per employee.
--    Holds ONLY non-derivable facts (the human decisions and their actors).
CREATE TABLE `employee_evaluation_tracking` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `date_hired_snapshot` DATE NULL,
  `recommendation_issued_at` DATETIME NULL,
  `recommendation_issued_by` INT NULL,
  `recommendation_letter_file` VARCHAR(255) NULL,
  `regularized_at` DATETIME NULL,
  `regularized_by` INT NULL,
  `terminated_at` DATETIME NULL,
  `terminated_by` INT NULL,
  `separation_type` VARCHAR(24) NULL,            -- 'failed_probation' | 'resigned' | 'laid_off'
  `termination_reason` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tracking_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Evaluation header — at most one non-voided 'first' and one 'second' per employee.
--    `result` is a HUMAN VERDICT. No identity snapshots: names are joined live from `user`.
CREATE TABLE `employee_evaluation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `eval_type` VARCHAR(10) NOT NULL,               -- 'first' | 'second'
  `evaluation_date` DATE NOT NULL,
  `total_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `rating_band` VARCHAR(40) NULL,
  `result` VARCHAR(10) NOT NULL,                  -- 'passed' | 'failed'
  `evaluator_comments` TEXT NULL,
  `evaluated_by` INT NULL,
  `voided_at` DATETIME NULL, `voided_by` INT NULL, `void_reason` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_evaluation_user_type` (`user_id`, `eval_type`, `voided_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Evaluation junction — the many-to-many SNAPSHOT of the KPI library at evaluation time.
--    These `*_snapshot` columns are load-bearing: editing the library later must never
--    rewrite a past evaluation.
CREATE TABLE `employee_evaluation_item` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `evaluation_id` INT NOT NULL,
  `criterion_id` INT NULL,
  `kpi_category_snapshot` VARCHAR(150) NOT NULL,
  `kpi_description_snapshot` TEXT NOT NULL,
  `target_snapshot` VARCHAR(255) NULL,
  `measurement_method_snapshot` VARCHAR(255) NULL,
  `weight_percentage_snapshot` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `rating` DECIMAL(2,1) NOT NULL DEFAULT 0.0,     -- app-enforced 1.0..5.0
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_evaluation_item_eval` (`evaluation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) PIP header — max one PIP per evaluation. `status` is a HUMAN VERDICT.
--    On `failed` the service immediately stamps tracking.terminated_at (no HR confirmation step).
CREATE TABLE `employee_pip` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `evaluation_id` INT NOT NULL,
  `pip_start_date` DATE NULL,
  `pip_end_date` DATE NULL,
  `immediate_superior_id` INT NULL,
  `detailed_concerns` TEXT NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'open',   -- 'open' | 'passed' | 'failed'
  `closed_at` DATETIME NULL, `closed_by` INT NULL,
  `employee_viewed_at` DATETIME NULL,
  `employee_ack_user_id` INT NULL,
  `employee_acknowledged_at` DATETIME NULL,
  `manager_ack_user_id` INT NULL,
  `manager_acknowledged_at` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pip_evaluation` (`evaluation_id`),
  INDEX `idx_pip_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) PIP area junction — SNAPSHOT of the areas library onto this PIP.
--    `selected = 0` rows are KEPT: the printed form shows every checkbox state.
CREATE TABLE `employee_pip_area` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `pip_id` INT NOT NULL,
  `pip_criteria_id` INT NULL,
  `area_name_snapshot` VARCHAR(150) NOT NULL,
  `selected` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pip_area` (`pip_id`, `pip_criteria_id`),
  INDEX `idx_pip_area_pip` (`pip_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8) PIP action-plan rows — free text, independent of the checkbox list.
--    `result` is INFORMATIONAL ONLY; it never auto-decides the PIP outcome.
CREATE TABLE `employee_pip_action_plan` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `pip_id` INT NOT NULL,
  `pip_area_id` INT NULL,
  `area_for_improvement` VARCHAR(255) NOT NULL,
  `action_plan` TEXT NULL,
  `review_date` DATE NULL,
  `result` VARCHAR(16) NULL,                      -- 'met' | 'partially_met' | 'not_met'
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT NULL, `updated_by` INT NULL,
  `created_at` DATETIME NULL, `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_pip_plan_pip` (`pip_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Derivation contract — these are NEVER stored

| Derived value | Computed from |
|---|---|
| Probation status (probationary / pip_open / recommendation_issued / regular / terminated) | `regularized_at`, `terminated_at`, `recommendation_issued_at`, plus any open/failed PIP |
| 3rd / 5th / 6th-month due dates | `date_hired_snapshot` (fallback `user.user_dateOfHire`) via `addMonthsClamped` |
| Next action, overdue flag | the above + which evaluations/PIPs exist |
| PIP sequence (1 or 2) | the linked `employee_evaluation.eval_type` |
| Per-item weighted score | `rating × weight_percentage_snapshot / 100` |
| `total_score`, `rating_band` | recomputed server-side from the snapshot weights on every write |

Terminal rule: a `failed` PIP is **absorbing** — it sets `tracking.terminated_at` and no further
writes to that PIP are allowed.

## Invariants MySQL cannot enforce (the service enforces them)

1. **≤ 1 non-voided evaluation per `(user_id, eval_type)`** — the UNIQUE key was deliberately
   dropped so that void-and-recreate corrections work; the create route checks it and answers 409.
2. **Σ `weight_percentage` of the ACTIVE criteria = 100 ± 0.01** — validated at *evaluation create*
   (when the snapshot is taken), not on every admin edit.
3. **A PIP may only follow a failed, non-voided evaluation**, and at most one PIP per evaluation
   (`uq_pip_evaluation` backs this).
4. **Voiding an evaluation is blocked while a PIP references it** (a void would orphan the PIP).

## Teardown order (no FKs — manual and ordered)

```
employee_pip_action_plan → employee_pip_area → employee_pip
  → employee_evaluation_item → employee_evaluation
  → employee_evaluation_tracking
```

## Write rules

- Every timestamp is passed explicitly from application code as PH wall-clock
  `'YYYY-MM-DD HH:mm:ss'`. Never rely on `CURRENT_TIMESTAMP` or `ON UPDATE`, never `toISOString()`.
- Actor columns are stamped from the JWT via the module-local
  `actorIdFromJwt` / `stampCreate` / `stampUpdate` helpers. A null actor omits the keys entirely —
  it never writes `NULL`.
- Directus writes are always **read back and zod-parsed**: a `200` does not prove persistence, and a
  PATCH naming an unknown column is silently discarded.
- Run the Directus schema Refresh after any ALTER TABLE, or new columns stay invisible to the API.
