export const EMPLOYEE_ID_CARD_WIDTH = 408;
export const EMPLOYEE_ID_CARD_HEIGHT = 648;

export const EMPLOYEE_ID_IMAGE_PLACEHOLDER =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export type EmployeeIdNodeType = "text" | "variable" | "image" | "shape";

export interface EmployeeIdNode {
    readonly id: string;
    readonly parentId: string;
    readonly type: EmployeeIdNodeType;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly rotation: number;
    readonly z: number;
    readonly opacity: number;
    readonly props: Record<string, unknown>;
}

export interface EmployeeIdPage {
    readonly id: string;
    readonly side: "front" | "back";
    readonly rootIds: string[];
}

export interface EmployeeIdDoc {
    readonly version: 2;
    readonly card: {
        readonly width: number;
        readonly height: number;
    };
    readonly pages: EmployeeIdPage[];
    readonly nodes: Record<string, EmployeeIdNode>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): unknown {
    if (raw.trim() === "") return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
}

function toFiniteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isEmployeeIdNodeType(value: unknown): value is EmployeeIdNodeType {
    return value === "text" || value === "variable" || value === "image" || value === "shape";
}

function parseEmployeeIdNode(id: string, raw: unknown): EmployeeIdNode | null {
    if (!isRecord(raw)) return null;
    if (!isEmployeeIdNodeType(raw.type)) return null;
    const nodeId = typeof raw.id === "string" && raw.id !== "" ? raw.id : id;
    if (raw.parentId !== "stage") return null;
    const x = toFiniteNumber(raw.x);
    const y = toFiniteNumber(raw.y);
    const w = toFiniteNumber(raw.w);
    const h = toFiniteNumber(raw.h);
    const rotation = toFiniteNumber(raw.rotation);
    const opacity = toFiniteNumber(raw.opacity);
    if (x === null || y === null || w === null || h === null || rotation === null || opacity === null) return null;
    if (w <= 0 || h <= 0 || opacity < 0 || opacity > 1) return null;
    if (typeof raw.z !== "number" || !Number.isInteger(raw.z) || raw.z < 0) return null;
    if (!isRecord(raw.props)) return null;
    return {
        id: nodeId,
        parentId: "stage",
        type: raw.type,
        x,
        y,
        w,
        h,
        rotation,
        z: raw.z,
        opacity,
        props: raw.props,
    };
}

export function parseEmployeeIdDoc(raw: unknown): EmployeeIdDoc | null {
    const root = typeof raw === "string" ? parseJson(raw) : raw;
    if (!isRecord(root) || root.version !== 2) return null;
    if (!isRecord(root.card) || root.card.width !== 408 || root.card.height !== 648) return null;
    if (!Array.isArray(root.pages) || root.pages.length !== 2) return null;
    if (!isRecord(root.nodes)) return null;
    const pages: EmployeeIdPage[] = [];
    for (const entry of root.pages) {
        if (!isRecord(entry)) return null;
        if (typeof entry.id !== "string" || entry.id === "") return null;
        if (entry.side !== "front" && entry.side !== "back") return null;
        if (!Array.isArray(entry.rootIds)) return null;
        const rootIds: string[] = [];
        for (const rootId of entry.rootIds) {
            if (typeof rootId !== "string" || rootId === "") return null;
            rootIds.push(rootId);
        }
        pages.push({ id: entry.id, side: entry.side, rootIds });
    }
    const front = pages.find((page) => page.side === "front");
    const back = pages.find((page) => page.side === "back");
    if (!front || !back) return null;
    const nodes: Record<string, EmployeeIdNode> = {};
    for (const [id, value] of Object.entries(root.nodes)) {
        const node = parseEmployeeIdNode(id, value);
        if (node === null) return null;
        nodes[id] = node;
    }
    const membership = new Map<string, number>();
    for (const page of pages) {
        for (const rootId of page.rootIds) {
            if (!nodes[rootId]) return null;
            membership.set(rootId, (membership.get(rootId) ?? 0) + 1);
        }
    }
    for (const id of Object.keys(nodes)) {
        if ((membership.get(id) ?? 0) !== 1) return null;
    }
    for (const page of pages) {
        const ordered = page.rootIds
            .map((rootId) => (nodes[rootId] as EmployeeIdNode).z)
            .sort((a, b) => a - b);
        const sequential = ordered.every((value, index) => value === index);
        if (!sequential) return null;
    }
    return { version: 2, card: { width: 408, height: 648 }, pages, nodes };
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function resolveEmployeeIdImageUrl(path?: string | null): string {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:")) return path;
    if (isUuid(path)) {
        return `/api/hrm/employee-admin/employee-master-list/assets/${path}`;
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
    return `${base}${path}`;
}

function cleanEmployeeIdFilenamePart(value: string): string {
    const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "");
    return cleaned.length > 0 ? cleaned : "unknown";
}

export function employeeIdExportFilename(side: "front" | "back", firstName: string, lastName: string): string {
    return `ID-${side}-${cleanEmployeeIdFilenamePart(firstName)}-${cleanEmployeeIdFilenamePart(lastName)}.png`;
}
