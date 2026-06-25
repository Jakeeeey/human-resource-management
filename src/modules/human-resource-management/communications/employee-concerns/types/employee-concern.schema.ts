import { z } from "zod";

/** System role for authorization. Mirrors the `role` column in the `user` table. */
export type UserRole = "ADMIN" | "HR" | "USER";

/**
 * Employee Concern Schema
 *
 * Maps 1:1 to the `employee_concerns` table (vos_database). Field names stay
 * snake_case end-to-end so the form payload, the Zod keys, and the Directus
 * body are identical — no transform layer needed (codebase convention).
 *
 * DB DDL (summary):
 *   id              int AUTO_INCREMENT PK
 *   user_id         int NULL  -> user.user_id   (employee the concern is for)
 *   subject_of_concern varchar(255) NOT NULL
 *   concern         text NOT NULL
 *   is_anonymous    bit(1) NOT NULL DEFAULT b'0'
 *   status          varchar(50) NOT NULL DEFAULT 'PENDING'
 *   created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
 *   created_by      int NULL  -> user.user_id   (encoder / submitter)
 */

/** Lifecycle of a concern. Mirrors the `status` varchar column. */
export const CONCERN_STATUSES = [
    "PENDING",
    "IN_REVIEW",
    "RESOLVED",
    "DISMISSED",
] as const;

export type ConcernStatus = (typeof CONCERN_STATUSES)[number];

/** Human labels for the status union (used by Select + badge). */
export const CONCERN_STATUS_LABELS: Record<ConcernStatus, string> = {
    PENDING: "Pending",
    IN_REVIEW: "In Review",
    RESOLVED: "Resolved",
    DISMISSED: "Dismissed",
};

/**
 * Defensive bit-field parser.
 *
 * Directus / MySQL `bit(1)` can arrive as any of: Buffer `{type:"Buffer",data:[1]}`,
 * string `"1"` / `"true"`, number `1` / `0`, or boolean. Mirrors the defensive
 * `is_deleted` handling documented in CONVENTIONS.md §5.
 */
export function parseBit(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
    if (value && typeof value === "object" && "type" in (value as Record<string, unknown>) && (value as { type: string }).type === "Buffer") {
        const data = (value as { data?: number[] }).data;
        return Array.isArray(data) ? data[0] === 1 : false;
    }
    return false;
}

/** Full record schema (matches Directus `employee_concerns` collection). */
export const EmployeeConcernSchema = z.object({
    id: z.number().optional(),
    user_id: z.number().nullable().optional(),
    subject_of_concern: z.string().min(1, "Subject is required").max(255, "Limit to 255 characters"),
    concern: z.string().min(1, "Please describe your concern"),
    // Stored as bit(1) in DB; Directus accepts a boolean.
    is_anonymous: z.boolean().default(false),
    status: z.enum(CONCERN_STATUSES).default("PENDING"),
    created_at: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
});

export type EmployeeConcern = z.infer<typeof EmployeeConcernSchema>;

/** Create-form schema — only the fields an employee fills in. */
export const EmployeeConcernFormSchema = z.object({
    subject_of_concern: z.string().min(1, "Subject is required").max(255, "Limit to 255 characters"),
    concern: z.string().min(1, "Please describe your concern"),
    is_anonymous: z.boolean().default(false),
});

export type EmployeeConcernForm = z.infer<typeof EmployeeConcernFormSchema>;

/** Status-update schema (admin). */
export const EmployeeConcernStatusSchema = z.object({
    status: z.enum(CONCERN_STATUSES),
});

export type EmployeeConcernStatusInput = z.infer<typeof EmployeeConcernStatusSchema>;

/**
 * Enriched concern — includes joined user relation fields for UI display.
 * `user_id` and `created_by` are M2O relations to the `user` collection.
 */
export interface EnrichedEmployeeConcern extends EmployeeConcern {
    user_name?: string;
    user_email?: string;
    created_by_name?: string;
}

/**
 * Employee Concern Attachment Schema
 *
 * Maps 1:1 to the `employee_concern_attachments` table (vos_database).
 *
 * DB DDL (summary):
 *   id              int AUTO_INCREMENT PK
 *   concern_id      int NOT NULL -> employee_concerns.id  (ON DELETE CASCADE)
 *   file_path       varchar(500) NOT NULL
 *   file_name       varchar(255) NOT NULL
 *   file_type       varchar(100) NULL
 *   created_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
 *   created_by      int NULL -> user.user_id
 *   updated_at      datetime NULL ON UPDATE CURRENT_TIMESTAMP
 *   updated_by      int NULL -> user.user_id
 */
export const EmployeeConcernAttachmentSchema = z.object({
    id: z.number(),
    concern_id: z.number(),
    file_path: z.string().min(1),
    file_name: z.string().min(1),
    file_type: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    updated_by: z.number().nullable().optional(),
});

export type EmployeeConcernAttachment = z.infer<typeof EmployeeConcernAttachmentSchema>;

/** Enriched attachment — includes joined creator name for UI display. */
export interface EnrichedEmployeeConcernAttachment extends EmployeeConcernAttachment {
    created_by_name?: string;
    /** Client-safe URL for viewing the file (routed through the API proxy). */
    view_url?: string;
}
