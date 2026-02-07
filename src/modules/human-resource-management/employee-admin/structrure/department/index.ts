/**
 * Department Module - Index
 * Central export point for the department module
 */

export { default as DepartmentModule } from "./DepartmentModule";

// Export types for external use
export type {
    Department,
    Division,
    User,
    DepartmentFilters,
} from "./types";

// Export hooks for advanced use cases
export { useDepartments } from "./hooks/userDepartments";
export { useDepartmentFilters } from "./hooks/userDepartmentFilters";

// Export provider for custom layouts
export { DepartmentFilterProvider } from "./providers/DepartmentFilterProvider";

// Export components for composition
export { DepartmentTable } from "./components/DepartmentTable";
export { DepartmentToolbar } from "./components/DepartmentToolbar";