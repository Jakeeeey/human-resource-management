---
description: DDL reference for the Role Management module (employee-admin > structure > role-management).
---

# Role Management — Database DDL Reference

All tables used by the Role Management module. Source of truth: `src/modules/human-resource-management/employee-admin/structrure/role-management/DDL.md`

---

## 1. `executive`
Top-level authority assignment. One row = one user assigned as an executive.

```sql
CREATE TABLE `executive` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`created_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	`is_deleted` TINYINT(1) NULL DEFAULT '0',
	`updated_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `FK_executive_user` (`user_id`) USING BTREE,
	INDEX `FK_executive_created_by` (`created_by`) USING BTREE,
	INDEX `FK_executive_updated_by` (`updated_by`) USING BTREE,
	CONSTRAINT `FK_executive_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT `FK_executive_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT `FK_executive_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
```

---

## 2. `division_sales_head`
Assigns a user as the head of a specific division. One division → one head.

```sql
CREATE TABLE `division_sales_head` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`division_id` INT NOT NULL,
	`user_id` INT NOT NULL,
	`created_by` INT NULL DEFAULT NULL,
	`created_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`is_deleted` TINYINT(1) NOT NULL DEFAULT '0',
	`updated_by` INT NULL DEFAULT NULL,
	`updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `fk_dsh_division` (`division_id`) USING BTREE,
	INDEX `fk_dsh_user` (`user_id`) USING BTREE,
	INDEX `fk_dsh_creator` (`created_by`) USING BTREE,
	INDEX `fk_dsh_updater` (`updated_by`) USING BTREE,
	CONSTRAINT `fk_dsh_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT `fk_dsh_division` FOREIGN KEY (`division_id`) REFERENCES `division` (`division_id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_dsh_updater` FOREIGN KEY (`updated_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT `fk_dsh_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE
);
```

---

## 3. `supervisor_per_division`
Assigns a supervisor (user) to a division. Multiple supervisors can be assigned to the same division.

```sql
CREATE TABLE `supervisor_per_division` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`division_id` INT NOT NULL,
	`supervisor_id` INT NOT NULL,
	`created_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	`is_deleted` TINYINT(1) NULL DEFAULT '0',
	`updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `fk_spd_division` (`division_id`) USING BTREE,
	INDEX `fk_spd_supervisor` (`supervisor_id`) USING BTREE,
	INDEX `fk_spd_creator` (`created_by`) USING BTREE,
	INDEX `fk_spd_updater` (`updated_by`) USING BTREE,
	CONSTRAINT `fk_spd_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT `fk_spd_division` FOREIGN KEY (`division_id`) REFERENCES `division` (`division_id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_spd_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `user` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_spd_updater` FOREIGN KEY (`updated_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL
);
```

---

## 4. `salesman_per_supervisor`
Links a salesman to a specific supervisor-division assignment. Represents the bottom of the hierarchy.

```sql
CREATE TABLE `salesman_per_supervisor` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`supervisor_per_division_id` INT NOT NULL,
	`salesman_id` INT NOT NULL,
	`created_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_by` INT NULL DEFAULT NULL,
	`is_deleted` TINYINT(1) NULL DEFAULT '0',
	`updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` INT NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `fk_sps_supervisor_div` (`supervisor_per_division_id`) USING BTREE,
	INDEX `fk_sps_salesman` (`salesman_id`) USING BTREE,
	INDEX `fk_sps_creator` (`created_by`) USING BTREE,
	INDEX `fk_sps_updater` (`updated_by`) USING BTREE,
	CONSTRAINT `fk_sps_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT `fk_sps_salesman` FOREIGN KEY (`salesman_id`) REFERENCES `salesman` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_sps_supervisor_div` FOREIGN KEY (`supervisor_per_division_id`) REFERENCES `supervisor_per_division` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_sps_updater` FOREIGN KEY (`updated_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE SET NULL
);
```

---

## 5. `target_setting_approver` (Review Committee)
Tracks who is authorized to approve target settings. Used by the Review Committee tab.

```sql
CREATE TABLE `target_setting_approver` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`target_period` DATE NOT NULL COMMENT 'fiscal_period from target_setting_executive',
	`status` ENUM('DRAFT','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
	`target_record_id` INT NOT NULL,
	`approver_id` INT NULL DEFAULT NULL,
	`approved_at` DATETIME NULL DEFAULT NULL,
	`is_deleted` TINYINT NULL DEFAULT '0',
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `FK_approver_user_idx` (`approver_id`) USING BTREE,
	CONSTRAINT `FK_approval_approver` FOREIGN KEY (`approver_id`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
```

---

## Related Core Tables (Referenced, Not Owned by This Module)

| Table | Key Column | Used For |
|---|---|---|
| `user` | `user_id` | All role assignments reference this |
| `division` | `division_id` | Division Head and Supervisor tabs |
| `salesman` | `id` | Salesman tab |

---

## Organizational Hierarchy

```
executive
  └── division_sales_head  (division_id → division)
        └── supervisor_per_division  (division_id → division, supervisor_id → user)
              └── salesman_per_supervisor  (supervisor_per_division_id, salesman_id → salesman)
```

The `target_setting_approver` table is a separate concern — it manages who can approve target records, not the sales hierarchy itself.
