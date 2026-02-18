# Role Management Schema Changes

## Optimized Tables

### target_setting_approver (Review Committee)
Simplified to only track who is an approver, removing complex period/status tracking which belongs in the target setting module itself.

```sql
CREATE TABLE target_setting_approver (
  id INT AUTO_INCREMENT PRIMARY KEY,
  approver_id INT NOT NULL, -- Links to directus_users
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted INT DEFAULT 0
);
```

### executive
```sql
CREATE TABLE executive (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted INT DEFAULT 0
);
```

### division_sales_head
```sql
CREATE TABLE division_sales_head (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division_id INT NOT NULL,
  user_id INT NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted INT DEFAULT 0
);
```

### supervisor_per_division
```sql
CREATE TABLE supervisor_per_division (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division_id INT NOT NULL,
  supervisor_id INT NOT NULL, -- Links to directus_users
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted INT DEFAULT 0
);
```

### salesman_per_supervisor
```sql
CREATE TABLE `target_setting_approver` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`approver_id` INT NULL DEFAULT NULL,
	`is_deleted` TINYINT NULL DEFAULT '0',
	`created_by` INT NULL DEFAULT NULL,
	`created_at` DATETIME NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `FK_approver_user_idx` (`approver_id`) USING BTREE,
	CONSTRAINT `FK_approval_approver` FOREIGN KEY (`approver_id`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=16
;
```
