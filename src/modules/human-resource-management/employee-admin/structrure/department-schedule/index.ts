/**
 * Department Schedule Module - Index
 * Module exports
 */

export { default as DepartmentScheduleModule } from "./DepartmentScheduleModule";

// Export types for external use
export type {
    Department,
    User,
    DepartmentSchedule,
    DepartmentScheduleWithRelations,
    DepartmentScheduleFilters,
    DepartmentScheduleFormData,
    CreateDepartmentScheduleData,
    UpdateDepartmentScheduleData,
} from "./types";

// Export hooks for advanced use cases
export { useDepartmentSchedules } from "./hooks/useDepartmentSchedules";
export { useDepartmentScheduleFilters } from "./hooks/useDepartmentScheduleFilters";

// Export provider for custom layouts
export { DepartmentScheduleFilterProvider } from "./providers/DepartmentScheduleFilterProvider";

// Export components for composition
export { DepartmentScheduleTable } from "./components/DepartmentScheduleTable";
export { DepartmentScheduleToolbar } from "./components/DepartmentScheduleToolbar";
export { DepartmentScheduleDialog } from "./components/DepartmentScheduleDialog";
export { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";