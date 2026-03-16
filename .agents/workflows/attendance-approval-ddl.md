---
description: DDLs for Attendance Approval Module
---

# Attendance Approval DDLs

## Tables

### attendance_approval
```sql
CREATE TABLE `attendance_approval` (
	`approval_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`employee_id` BIGINT UNSIGNED NOT NULL DEFAULT '0',
	`date_schedule` DATE NOT NULL DEFAULT '1970-01-01',
	`approved_by` INT NOT NULL,
	`approved_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`work_minutes` INT NOT NULL DEFAULT '0',
	`late_minutes` INT NOT NULL DEFAULT '0',
	`undertime_minutes` INT NOT NULL DEFAULT '0',
	`overtime_minutes` INT NOT NULL DEFAULT '0',
	`remarks` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('approved','rejected') NOT NULL DEFAULT 'approved' COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`approval_id`) USING BTREE
) COLLATE='utf8mb4_0900_ai_ci' ENGINE=InnoDB;
```

### attendance_log
```sql
CREATE TABLE `attendance_log` (
	`log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` INT NOT NULL,
	`department_id` INT NOT NULL,
	`log_date` DATE NOT NULL,
	`time_in` DATETIME NULL DEFAULT NULL,
	`lunch_start` DATETIME NULL DEFAULT NULL,
	`lunch_end` DATETIME NULL DEFAULT NULL,
	`break_start` DATETIME NULL DEFAULT NULL,
	`break_end` DATETIME NULL DEFAULT NULL,
	`time_out` DATETIME NULL DEFAULT NULL,
	`image_time_in` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`image_time_out` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('On Time','Late','Absent','Half Day','Incomplete','Leave','Holiday') NULL DEFAULT 'On Time' COLLATE 'utf8mb4_0900_ai_ci',
	`created_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	`approval_status` ENUM('pending','approved','rejected') NULL DEFAULT 'pending' COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`log_id`) USING BTREE,
	UNIQUE INDEX `uq_user_date` (`user_id`, `log_date`) USING BTREE,
	INDEX `idx_att_user` (`user_id`) USING BTREE,
	INDEX `idx_att_dept_date` (`department_id`, `log_date`) USING BTREE,
	CONSTRAINT `fk_att_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`),
	CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) COLLATE='utf8mb4_0900_ai_ci' ENGINE=InnoDB;
```

### department
```sql
CREATE TABLE `department` (
	`department_id` INT NOT NULL AUTO_INCREMENT,
	`department_name` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`parent_division` INT NOT NULL DEFAULT '0',
	`department_description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`department_head` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`department_head_id` INT NULL DEFAULT NULL,
	`tax_id` INT NULL DEFAULT NULL,
	`date_added` DATE NULL DEFAULT NULL,
	PRIMARY KEY (`department_id`) USING BTREE,
	UNIQUE INDEX `department_name` (`department_name`) USING BTREE,
	INDEX `idx_department_department_head_id` (`department_head_id`) USING BTREE,
	CONSTRAINT `fk_department_department_head_user` FOREIGN KEY (`department_head_id`) REFERENCES `user` (`user_id`)
) COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;
```

### department_schedule
```sql
CREATE TABLE `department_schedule` (
	`schedule_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`department_id` INT NOT NULL DEFAULT '0',
	`working_days` TINYINT UNSIGNED NOT NULL,
	`work_start` TIME NOT NULL,
	`work_end` TIME NOT NULL,
	`lunch_start` TIME NOT NULL DEFAULT '12:00:00',
	`lunch_end` TIME NOT NULL DEFAULT '13:00:00',
	`break_start` TIME NOT NULL DEFAULT '15:00:00',
	`break_end` TIME NOT NULL DEFAULT '15:30:00',
	`workdays_note` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`created_at` DATETIME NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` DATETIME NULL DEFAULT NULL,
	PRIMARY KEY (`schedule_id`) USING BTREE,
	UNIQUE INDEX `uq_department_schedule` (`department_id`) USING BTREE,
	CONSTRAINT `FK_department_schedule_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`)
) COLLATE='utf8mb4_0900_ai_ci' ENGINE=InnoDB;
```

### oncall_schedule
```sql
CREATE TABLE `oncall_schedule` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`department_id` INT NOT NULL,
	`group` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`working_days` INT NOT NULL,
	`work_start` TIME NOT NULL,
	`work_end` TIME NOT NULL,
	`lunch_start` TIME NULL DEFAULT '12:00:00',
	`lunch_end` TIME NULL DEFAULT '13:00:00',
	`break_start` TIME NULL DEFAULT '15:00:00',
	`break_end` TIME NULL DEFAULT '15:30:00',
	`workdays` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`created_at?` DATETIME NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` DATETIME NULL DEFAULT NULL,
	`encoder_id` INT NOT NULL,
	`schedule_date` DATE NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_oncallsched_department_id` (`department_id`) USING BTREE,
	INDEX `idx_oncallsched_encoder_id` (`encoder_id`) USING BTREE,
	CONSTRAINT `fk_oncallsched_department` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`),
	CONSTRAINT `fk_oncallsched_user` FOREIGN KEY (`encoder_id`) REFERENCES `user` (`user_id`)
) COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;
```

### oncall_list
```sql
CREATE TABLE `oncall_list` (
	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`dept_sched_id` BIGINT UNSIGNED NOT NULL, -- Verified link to oncall_schedule.id
	`user_id` INT NOT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_oncall_dept_sched_id` (`dept_sched_id`) USING BTREE,
	INDEX `idx_oncall_user_id` (`user_id`) USING BTREE,
	CONSTRAINT `fk_oncalllist_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;
```

### user
```sql
CREATE TABLE `user` (
	`user_id` INT NOT NULL AUTO_INCREMENT,
	`user_email` VARCHAR(255) NOT NULL,
	`user_password` VARCHAR(255) NULL,
	`user_fname` VARCHAR(255) NOT NULL,
	`user_mname` VARCHAR(255) NULL,
	`user_lname` VARCHAR(255) NOT NULL,
	`user_contact` VARCHAR(255) NOT NULL,
	`user_province` VARCHAR(255) NOT NULL,
	`user_city` VARCHAR(255) NOT NULL,
	`user_brgy` VARCHAR(255) NOT NULL,
	`user_department` INT NULL,
	`user_sss` VARCHAR(255) NULL,
	`user_philhealth` VARCHAR(255) NULL,
	`user_tin` VARCHAR(255) NULL,
	`user_position` VARCHAR(255) NOT NULL,
	`user_dateOfHire` DATE NOT NULL,
	`user_tags` VARCHAR(255) NULL,
	`user_bday` DATE NULL,
	`role_id` INT NULL,
	`user_image` TEXT NULL,
	`updateAt` TIMESTAMP NULL,
	`external_id` VARCHAR(255) NULL,
	`is_deleted` BIT(1) NULL,
	`biometric_id` VARCHAR(255) NULL,
	`rf_id` VARCHAR(255) NULL,
	`isAdmin` TINYINT(1) NOT NULL DEFAULT '0',
	`user_pagibig` VARCHAR(255) NULL,
	`signature` TEXT NULL,
	`emergency_contact_name` VARCHAR(255) NULL,
	`emergency_contact_number` VARCHAR(50) NULL,
	`role` VARCHAR(10) NOT NULL DEFAULT 'USER',
	`hash_password` VARCHAR(255) NULL,
	PRIMARY KEY (`user_id`) USING BTREE
) COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;
```
