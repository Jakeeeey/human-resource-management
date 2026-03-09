# Employee Masterlist Schema

## Tables

### user
The main table for employee/user information.

```sql
CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) NOT NULL,
  `user_fname` varchar(255) NOT NULL,
  `user_mname` varchar(255) DEFAULT NULL,
  `user_lname` varchar(255) NOT NULL,
  `user_contact` varchar(255) NOT NULL,
  `user_province` varchar(255) NOT NULL,
  `user_city` varchar(255) NOT NULL,
  `user_brgy` varchar(255) NOT NULL,
  `user_department` int DEFAULT NULL,
  `user_sss` varchar(255) DEFAULT NULL,
  `user_philhealth` varchar(255) DEFAULT NULL,
  `user_tin` varchar(255) DEFAULT NULL,
  `user_position` varchar(255) NOT NULL,
  `user_dateOfHire` date NOT NULL,
  `user_tags` varchar(255) DEFAULT NULL,
  `user_bday` date DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `user_image` text,
  `isAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `role` varchar(10) NOT NULL DEFAULT 'USER',
  `isDeleted` bit(1) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### department
Used for categorizing employees.

```sql
CREATE TABLE `department` (
  `department_id` int NOT NULL AUTO_INCREMENT,
  `department_name` varchar(255) NOT NULL,
  `parent_division` int NOT NULL DEFAULT '0',
  `department_description` text,
  `department_head_id` int DEFAULT NULL,
  PRIMARY KEY (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### employee_file_records
Stores references to documents uploaded for employees.

```sql
CREATE TABLE `employee_file_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `list_id` BIGINT UNSIGNED NOT NULL,
    `record_name` VARCHAR(150) NOT NULL COLLATE 'utf8mb4_unicode_ci',
    `description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
    `file_ref` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    `created_by` INT NULL DEFAULT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL DEFAULT NULL,
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_efr_user_id` (`user_id`) USING BTREE
);
```

### employee_file_record_category
Categories for employee records (e.g., Personal, Employment, Legal).

```sql
CREATE TABLE `employee_file_record_category` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    PRIMARY KEY (`id`)
);
```

### employee_file_record_type
Specific types of records (e.g., PSA Birth Certificate, Contract, NBI Clearance).

```sql
CREATE TABLE `employee_file_record_type` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    PRIMARY KEY (`id`)
);
```

### employee_file_record_list
Links records to types.

```sql
CREATE TABLE `employee_file_record_list` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `record_type_id` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`)
);
```
