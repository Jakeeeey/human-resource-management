# Module Analysis: Employee Masterlist

This document provides a deep dive into the logic, data flows, and functions of the Employee Masterlist module.

## 1. Module Overview
The Employee Masterlist is the core repository for organizational human resources. It provides a centralized interface for managing employee profiles, assets, files, and HR analytics.

- **Path**: `src/modules/human-resource-management/employee-admin/employee-admin-master-list/`
- **Entry Point**: `EmployeeMasterlistModule.tsx`
- **Backend**: Spring Boot Proxy (`/api/hrm/employee-admin/employee-master-list`)

## 2. Logic & Data Flow Analysis

### Data Retrieval Flow
The module employs a "Fetch-Filter-Display" protocol:
1. **Fetch**: `useEmployeeMasterlist` hook fetches all employees and departments concurrently using `Promise.all`.
2. **Filtering (Soft-Delete)**: A robust filtering logic in `useEmployeeMasterlist.ts` handles various soft-delete flag formats from the database:
   - **Buffer/Object**: `{ type: "Buffer", data: [1] }` (where `1` is deleted).
   - **String**: `"1"`, `"true"`, `"0"`, `"false"`.
   - **Number/Boolean**: `1/0`, `true/false`.
   - **Fields Checked**: `isDeleted`, `is_deleted`, `deleted`.
3. **Display**: Active employees are stored in state and passed to the `EmployeeTable` component.

### Mutation Flow (create/Update/Delete)
1. **Action**: User triggers a mutation (e.g., "New Employee" modal).
2. **API Call**: Handled by `springProvider.ts` via standard fetch requests to the proxy.
3. **Synchronization**: Upon successful response, the manual `refetch()` is called to synchronize the local state with the backend.

## 3. Core Functions Breakdown

### Provider: `springProvider.ts`
Handles interactions with the Spring Boot HR service.
- **`createEmployeeSpring(payload)`**: `POST` request to `/create`. Translates frontend form data to backend-expected field naming.
- **`updateEmployeeSpring(id, payload)`**: `PUT` request to `/update/{id}`. Supports partial updates.
- **`deleteEmployeeSpring(id)`**: `DELETE` request to `/delete/{id}`. Triggers server-side soft-deletion.

### Hook: `useEmployeeMasterlist.ts`
The state engine of the module.
- **`fetchEmployees()`**: Encapsulates the filtering logic and API call to Directus.
- **`removeEmployee(id)`**: Wraps the delete API call with error handling and success toasts.
- **`updateEmployee(id, data)`**: Wraps the update API call and triggers state refresh.

## 4. Component Architecture
- **`EmployeeTable`**: High-density data grid for listing and quick actions.
- **`AddEmployeeModal`**: Complex multi-section form including Personal, Address, Emergency, and Work details.
- **`EmployeeDetailsModal`**: Tabbed interface (`EditProfileTab`, `EmployeeAssetsTab`, `EmployeeFilesTab`, `EmployeeIdTab`) for deep profile management.
- **`EmployeeInfographics`**: Visual representation of HR metrics.

## 6. Reporting & Analytics Enhancements

### Export Summary (PDF)
The module features a high-fidelity, multi-page report generation system:
- **Demographics Page**: Visualizes Gender, Civil Status, Age Groups, Nationality, Religion, and Geographic distribution using custom-rendered doughnut and bar charts.
- **Directory Table**: A comprehensive list of active employees including position, department, and contact info (Gov IDs excluded for summary security).

### HR Analytics (UI)
The interactive dashboard provides real-time insights:
- **Hiring Trends**: Area chart visualizing annual recruitment volume.
- **Diversity Metrics**: Breakdown of gender, religion, and civil status.
- **Geographic Mapping**: Interactive Leaflet-based map of employee residences.
- **Biometric/Identifier Readiness**: Support for tracking RFID and Biometric IDs.
