/**
 * Division Module - Index
 * Central export point
 */

export { default as DivisionModule } from "./DivisionModule";

// types
export type {
    Division,
    Department,
    User,
    DivisionWithRelations,
} from "./types";

// hooks
export { useDivisions } from "./hooks/useDivisions";
export { useDivisionFilters } from "./hooks/useDivisionFilters";

// provider
export { DivisionFilterProvider } from "./providers/DivisionFilterProvider";

// components
export { DivisionTable } from "./components/DivisionTable";
export { DivisionToolbar } from "./components/DivisionToolbar";
