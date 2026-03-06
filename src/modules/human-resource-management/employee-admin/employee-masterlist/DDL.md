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
