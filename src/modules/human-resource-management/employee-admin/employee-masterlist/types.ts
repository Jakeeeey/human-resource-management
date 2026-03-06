/**
 * Types for Employee Masterlist Module
 * Aligned with Spring Boot /users API response schema
 */

export interface Department {
  department_id: number;
  department_name: string;
  parent_division: number;
  department_description?: string;
  department_head?: string;
  department_head_id?: number;
  tax_id?: number;
  date_added?: string;
}

/** Matches the Spring Boot GET /users response object */
export interface User {
  id: number;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  contact?: string;
  province?: string;
  city?: string;
  brgy?: string;
  department?: number | null;
  sssNumber?: string;
  philHealthNumber?: string;
  tinNumber?: string;
  pagibigNumber?: string;
  position?: string;
  dateOfHire?: string;
  tags?: string | null;
  birthday?: string | null;
  image?: string | null;
  signature?: string | null;
  rfId?: string | null;
  isAdmin?: boolean | null;
  biometricId?: string | null;
  externalId?: string | null;
  isDeleted?: boolean | null;
  updateAt?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
}

export type Employee = User;

export interface EmployeeMasterlistFilters {
  search?: string;
  department_id?: number;
  status?: "active" | "inactive";
}
