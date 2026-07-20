import { z } from "zod";

// ─── Database Entity Interfaces ────────────────────────────────────

export interface ManufacturingLine {
    id: number;
    line_name: string;
    description: string | null;
    target_produce_8_hrs: number;
    overtime_target_per_hr: number;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
}

export interface LinePosition {
    id: number;
    line_id: number;
    position_name: string;
    description: string | null;
    persons_allowed: number;
    position_rate: number;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
}

/** Extended type: a line bundled with its nested positions */
export interface ManufacturingLineWithPositions extends ManufacturingLine {
    positions: LinePosition[];
}

// ─── Zod Form Schemas ──────────────────────────────────────────────

export const lineFormSchema = z.object({
    line_name: z
        .string()
        .min(1, "Line name is required")
        .max(255, "Line name must be 255 characters or less"),
    description: z.string().nullable().optional(),
    target_produce_8_hrs: z
        .number()
        .int("Must be a whole number")
        .min(1, "Target must be at least 1"),
    overtime_target_per_hr: z
        .number()
        .int("Must be a whole number")
        .min(1, "OT target must be at least 1"),
});

export type LineFormValues = z.infer<typeof lineFormSchema>;

export const positionFormSchema = z.object({
    position_name: z
        .string()
        .min(1, "Position name is required")
        .max(255, "Position name must be 255 characters or less"),
    description: z.string().nullable().optional(),
    persons_allowed: z
        .number()
        .int("Must be a whole number")
        .min(1, "At least 1 person must be allowed"),
    position_rate: z
        .number()
        .min(0, "Rate must be a positive number"),
});

export type PositionFormValues = z.infer<typeof positionFormSchema>;
