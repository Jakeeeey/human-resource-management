export interface DirectoryDepartment {
    id: number;
    name: string;
}

export interface DirectoryEmployee {
    id: number;
    fullName: string;
}

const DIRECTORY_BASE = "/api/hrm/employee-admin/employee-master-list";

function unwrapList(body: unknown): unknown[] {
    if (Array.isArray(body)) {
        return body;
    }
    if (typeof body === "object" && body !== null && "data" in body) {
        const data = (body as { data: unknown }).data;
        if (Array.isArray(data)) {
            return data;
        }
    }
    throw new Error("The directory returned data in an unexpected shape.");
}

function toPositiveInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value.trim());
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
}

function toTrimmed(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function isDeletedEmployee(row: Record<string, unknown>): boolean {
    const flag = row.isDeleted ?? row.is_deleted ?? row.deleted;
    if (flag === true || flag === 1) {
        return true;
    }
    if (typeof flag === "string") {
        const normalized = flag.trim().toLowerCase();
        return normalized === "1" || normalized === "true";
    }
    return false;
}

async function fetchDirectoryList(path: string): Promise<unknown[]> {
    const res = await fetch(path, { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        const message =
            typeof body === "object" && body !== null && "message" in body &&
            typeof (body as { message: unknown }).message === "string"
                ? ((body as { message: string }).message as string)
                : "Failed to load the directory";
        throw new Error(message);
    }
    return unwrapList(body);
}

export async function listDirectoryDepartments(): Promise<DirectoryDepartment[]> {
    const rows = await fetchDirectoryList(`${DIRECTORY_BASE}/departments`);
    const departments: DirectoryDepartment[] = [];
    for (const row of rows) {
        if (typeof row !== "object" || row === null) {
            continue;
        }
        const record = row as Record<string, unknown>;
        const id = toPositiveInt(record.department_id);
        const name = toTrimmed(record.department_name);
        if (id === null || name === "") {
            continue;
        }
        departments.push({ id, name });
    }
    departments.sort((left, right) => left.name.localeCompare(right.name));
    return departments;
}

export async function listDirectoryEmployees(): Promise<DirectoryEmployee[]> {
    const rows = await fetchDirectoryList(`${DIRECTORY_BASE}/employees`);
    const employees: DirectoryEmployee[] = [];
    for (const row of rows) {
        if (typeof row !== "object" || row === null) {
            continue;
        }
        const record = row as Record<string, unknown>;
        if (isDeletedEmployee(record)) {
            continue;
        }
        const id = toPositiveInt(record.id ?? record.user_id);
        if (id === null) {
            continue;
        }
        const fullName = [toTrimmed(record.firstName), toTrimmed(record.lastName)]
            .filter((part) => part !== "")
            .join(" ");
        const fallback = toTrimmed(record.email);
        employees.push({ id, fullName: fullName !== "" ? fullName : fallback !== "" ? fallback : "Unknown employee" });
    }
    employees.sort((left, right) => left.fullName.localeCompare(right.fullName));
    return employees;
}
