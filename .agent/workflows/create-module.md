---
description: Create a new system module following the standard anatomy and principles.
---

# Workflow: Creating a New Module

Follow these steps strictly to ensure consistency and isolation.

### 1. Preparation
1. Identify the module name (e.g., `inventory-management`).
2. Create the directory: `src/modules/<module-name>/`.

### 2. Implementation Steps
1. **Define Types** (`src/modules/<module-name>/types.ts`):
   - Define domain models and DTOs.
   - Use explicit types, avoid `any`.

2. **Implement Providers** (`src/modules/<module-name>/providers/fetchProvider.ts`):
   - Use the central HTTP client: `import { http } from "@/lib/http/client"`.
   - Expose intent-based functions (e.g., `listItems`, `createItem`).

3. **Build UI Components** (`src/modules/<module-name>/components/`):
   - Use **shadcn** components exclusively.
   - Separate tables, forms, and dialogs.

4. **Add Hooks** (`src/modules/<module-name>/hooks/`):
   - Orchestrate fetching and state (e.g., `useItemManagement`).

5. **Create Entry Component** (`src/modules/<module-name>/<ModuleName>Module.tsx`):
   - Compose components and connect hooks.

6. **Expose Public Surface** (`src/modules/<module-name>/index.ts`):
   - Export only types and the entry component.

7. **Register Route** (`src/app/(app)/<route>/page.tsx`):
   - Import only the module entry component.

### 3. Definition of Done Checklist
- [ ] Module follows standard folder structure.
- [ ] `types.ts` includes complete domain types (no `any`).
- [ ] All API calls use `src/lib/http/client.ts`.
- [ ] Provider functions are intent-based.
- [ ] UI has loading, error, and empty states.
- [ ] Mapping logic lives in `utils/`.
- [ ] Route page renders only the module entry component.
