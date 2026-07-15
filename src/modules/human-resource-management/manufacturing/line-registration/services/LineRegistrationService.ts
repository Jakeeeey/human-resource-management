import type {
    ManufacturingLine,
    ManufacturingLineWithPositions,
    LinePosition,
    LineFormValues,
    PositionFormValues,
} from "../types";

/**
 * Client-side service layer for Manufacturing Line Registration.
 * All methods call the local Next.js API proxy routes.
 */
export class LineRegistrationService {
    // ── Lines ────────────────────────────────────────────────────────

    static async getLines(): Promise<ManufacturingLine[]> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/lines?limit=-1&sort=-created_at`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching manufacturing lines:", error);
            return [];
        }
    }

    static async getLineById(id: number): Promise<ManufacturingLineWithPositions | null> {
        try {
            const [lineRes, posRes] = await Promise.all([
                fetch(`/api/hrm/manufacturing/lines?id=${id}`),
                fetch(`/api/hrm/manufacturing/line-positions?filter={"line_id":{"_eq":${id}}}&limit=-1&sort=position_name`),
            ]);

            if (!lineRes.ok) return null;
            const { data: line } = await lineRes.json();
            const positions = posRes.ok ? (await posRes.json()).data || [] : [];

            return { ...line, positions };
        } catch (error) {
            console.error("Error fetching line by id:", error);
            return null;
        }
    }

    static async createLine(data: LineFormValues): Promise<ManufacturingLine | null> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/lines`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) return null;
            const { data: created } = await res.json();
            return created;
        } catch (error) {
            console.error("Error creating line:", error);
            return null;
        }
    }

    static async updateLine(id: number, data: Partial<LineFormValues>): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/lines?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            return res.ok;
        } catch (error) {
            console.error("Error updating line:", error);
            return false;
        }
    }

    static async deleteLine(id: number): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/lines?id=${id}`, {
                method: "DELETE",
            });
            return res.ok || res.status === 204;
        } catch (error) {
            console.error("Error deleting line:", error);
            return false;
        }
    }

    // ── Positions ────────────────────────────────────────────────────

    static async getPositions(lineId: number): Promise<LinePosition[]> {
        try {
            const res = await fetch(
                `/api/hrm/manufacturing/line-positions?filter={"line_id":{"_eq":${lineId}}}&limit=-1&sort=position_name`
            );
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching positions:", error);
            return [];
        }
    }

    static async createPosition(data: PositionFormValues & { line_id: number }): Promise<LinePosition | null> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/line-positions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) return null;
            const { data: created } = await res.json();
            return created;
        } catch (error) {
            console.error("Error creating position:", error);
            return null;
        }
    }

    static async updatePosition(id: number, data: Partial<PositionFormValues>): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/line-positions?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            return res.ok;
        } catch (error) {
            console.error("Error updating position:", error);
            return false;
        }
    }

    static async deletePosition(id: number): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/line-positions?id=${id}`, {
                method: "DELETE",
            });
            return res.ok || res.status === 204;
        } catch (error) {
            console.error("Error deleting position:", error);
            return false;
        }
    }
}
