import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { ORIENTATION_ERROR_CODES } from "./orientation-task-service";
import type { OrientationEmployee } from "./types/orientation.schema";

// orientationRoster.ts — the tab's employee roster (`user` rows, newest id
// first). Read-only and lightweight — the transitional picker until the hub
// roster (todo 27) owns hire selection. Split out of
// `orientation-task-service.ts` (todo 7) so the orientation engine stays under
// the 250-pure-LOC ceiling; the export name and contract are unchanged.

const EmployeeRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_fname: z.string().nullable(),
  user_lname: z.string().nullable(),
});

/**
 * @returns One entry per employee with a display name.
 * @throws `ORIENTATION_EMPLOYEE_READ_FAILED` when the read fails (never a
 * silent empty roster).
 */
export async function listOrientationEmployees(): Promise<
  OrientationEmployee[]
> {
  const body: unknown = await dFetch(
    "/items/user?fields=user_id,user_fname,user_lname&sort=-user_id&limit=-1"
  );
  const parsed = z.object({ data: z.array(EmployeeRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${
        ORIENTATION_ERROR_CODES.employeeReadFailed
      }: user roster read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data.map((row) => ({
    user_id: row.user_id,
    name:
      [row.user_fname, row.user_lname].filter(Boolean).join(" ").trim() ||
      `Employee #${row.user_id}`,
  }));
}
