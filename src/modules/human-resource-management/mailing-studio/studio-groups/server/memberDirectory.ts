import { unwrapStudioGroupsData } from "./capability";
import {
    extractCompanyDomain,
    resolveCustomerEmail,
    resolveEmployeeEmail,
} from "./emailResolution";
import { dFetch } from "../utils/directus";

export const EMPLOYEE_DIRECTORY_FIELDS = "user_id,user_fname,user_lname,user_email,personal_email";

export const CUSTOMER_DIRECTORY_FIELDS = "id,customer_code,customer_name,store_name,customer_email,isActive,type";

const COMPANY_DIRECTORY_FIELDS = "company_id,company_email";

const COMPANY_DIRECTORY_LIMIT = 100;

export const DIRECTORY_DEFAULT_LIMIT = 10;

export const DIRECTORY_MAX_LIMIT = 25;

export interface DirectorySearchInput {
    readonly query: string;
    readonly page: number;
    readonly limit: number;
}

export interface EmployeeDirectoryItem {
    readonly ref: number;
    readonly name: string;
    readonly email: string | null;
    readonly selectable: boolean;
    readonly reason: string | null;
}

export interface CustomerDirectoryItem {
    readonly ref: number;
    readonly name: string;
    readonly subtitle: string | null;
    readonly email: string | null;
    readonly active: boolean;
    readonly selectable: boolean;
    readonly reason: string | null;
}

export interface DirectoryPage<T> {
    readonly items: T[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}

export interface DirectoryCandidate {
    readonly ref: number;
    readonly email: string | null;
}

function cleanCandidateQuery(query: string): string {
    return query.trim().slice(0, 120);
}

interface EmployeeDirectoryRow {
    user_id?: unknown;
    user_fname?: unknown;
    user_lname?: unknown;
    user_email?: unknown;
    personal_email?: unknown;
}

interface CustomerDirectoryRow {
    id?: unknown;
    customer_name?: unknown;
    store_name?: unknown;
    customer_email?: unknown;
    isActive?: unknown;
}

function normalizedInput(input: DirectorySearchInput): { query: string; page: number; limit: number } {
    const query = input.query.trim().slice(0, 120);
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
    const limit =
        Number.isInteger(input.limit) && input.limit > 0
            ? Math.min(input.limit, DIRECTORY_MAX_LIMIT)
            : DIRECTORY_DEFAULT_LIMIT;
    return { query, page, limit };
}

function describeDirectusErrors(body: unknown): string | null {
    if (typeof body !== "object" || body === null || !("errors" in body)) return null;
    const errors = (body as { errors?: Array<{ message?: string }> }).errors;
    if (!Array.isArray(errors) || errors.length === 0) return "unknown error";
    return errors.map((entry) => entry.message ?? "unknown error").join("; ");
}

function readFilterCount(body: unknown, fallback: number): number {
    if (typeof body !== "object" || body === null || !("meta" in body)) return fallback;
    const count = (body as { meta?: { filter_count?: unknown } }).meta?.filter_count;
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : fallback;
}

function textOf(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export async function readCompanyDomains(): Promise<Set<string>> {
    const domains = new Set<string>();
    try {
        const body = await dFetch(`/items/company_list?fields=${COMPANY_DIRECTORY_FIELDS}&limit=${COMPANY_DIRECTORY_LIMIT}`);
        if (describeDirectusErrors(body) !== null) return domains;
        const rows = unwrapStudioGroupsData<Array<{ company_email?: unknown }>>(body);
        if (!Array.isArray(rows)) return domains;
        for (const row of rows) {
            const domain = extractCompanyDomain(row.company_email);
            if (domain !== null) domains.add(domain);
        }
    } catch {
        return domains;
    }
    return domains;
}

function employeeSearchClause(query: string): string {
    if (query === "") return "";
    const encoded = encodeURIComponent(query);
    return (
        `&filter[_or][0][user_fname][_icontains]=${encoded}` +
        `&filter[_or][1][user_lname][_icontains]=${encoded}` +
        `&filter[_or][2][user_email][_icontains]=${encoded}` +
        `&filter[_or][3][personal_email][_icontains]=${encoded}`
    );
}

function customerSearchClause(query: string): string {
    if (query === "") return "";
    const encoded = encodeURIComponent(query);
    return (
        `&filter[_or][0][customer_name][_icontains]=${encoded}` +
        `&filter[_or][1][store_name][_icontains]=${encoded}` +
        `&filter[_or][2][customer_code][_icontains]=${encoded}` +
        `&filter[_or][3][customer_email][_icontains]=${encoded}`
    );
}

function employeeName(row: EmployeeDirectoryRow, email: string | null): string {
    const full = `${textOf(row.user_fname)} ${textOf(row.user_lname)}`.trim().replace(/\s+/g, " ");
    if (full !== "") return full;
    if (email !== null) return email;
    return "Unnamed employee";
}

export async function searchEmployees(input: DirectorySearchInput): Promise<DirectoryPage<EmployeeDirectoryItem>> {
    const { query, page, limit } = normalizedInput(input);
    const companyDomains = await readCompanyDomains();
    const path =
        `/items/user?fields=${EMPLOYEE_DIRECTORY_FIELDS}` +
        `&sort=user_fname,user_lname&limit=${limit}&page=${page}&meta=filter_count` +
        employeeSearchClause(query);
    const body = await dFetch(path);
    const failure = describeDirectusErrors(body);
    if (failure !== null) throw new Error(`Employee directory search failed: ${failure}`);
    const rows = unwrapStudioGroupsData<EmployeeDirectoryRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    const items: EmployeeDirectoryItem[] = [];
    for (const row of list) {
        if (typeof row.user_id !== "number" || !Number.isInteger(row.user_id)) continue;
        const email = resolveEmployeeEmail(
            { personal_email: row.personal_email, user_email: row.user_email },
            companyDomains
        );
        items.push({
            ref: row.user_id,
            name: employeeName(row, email),
            email,
            selectable: email !== null,
            reason: email === null ? "No usable email on file" : null,
        });
    }
    return { items, total: readFilterCount(body, items.length), page, pageSize: limit };
}

export async function collectAllEmployeeCandidates(query: string): Promise<DirectoryCandidate[]> {
    const companyDomains = await readCompanyDomains();
    const path =
        "/items/user?fields=user_id,personal_email,user_email&sort=user_fname,user_lname&limit=-1" +
        employeeSearchClause(cleanCandidateQuery(query));
    const body = await dFetch(path);
    const failure = describeDirectusErrors(body);
    if (failure !== null) throw new Error(`Employee directory search failed: ${failure}`);
    const rows = unwrapStudioGroupsData<EmployeeDirectoryRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    const candidates: DirectoryCandidate[] = [];
    for (const row of list) {
        if (typeof row.user_id !== "number" || !Number.isInteger(row.user_id)) continue;
        candidates.push({
            ref: row.user_id,
            email: resolveEmployeeEmail(
                { personal_email: row.personal_email, user_email: row.user_email },
                companyDomains
            ),
        });
    }
    return candidates;
}

export async function collectAllCustomerCandidates(query: string): Promise<DirectoryCandidate[]> {
    const path =
        "/items/customer?fields=id,customer_email&sort=customer_name&limit=-1" +
        customerSearchClause(cleanCandidateQuery(query));
    const body = await dFetch(path);
    const failure = describeDirectusErrors(body);
    if (failure !== null) throw new Error(`Customer directory search failed: ${failure}`);
    const rows = unwrapStudioGroupsData<CustomerDirectoryRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    const candidates: DirectoryCandidate[] = [];
    for (const row of list) {
        if (typeof row.id !== "number" || !Number.isInteger(row.id)) continue;
        candidates.push({ ref: row.id, email: resolveCustomerEmail(row.customer_email) });
    }
    return candidates;
}

function customerName(row: CustomerDirectoryRow, email: string | null): string {
    const name = textOf(row.customer_name);
    if (name !== "") return name;
    const store = textOf(row.store_name);
    if (store !== "") return store;
    if (email !== null) return email;
    return "Unnamed customer";
}

function customerSubtitle(row: CustomerDirectoryRow, name: string): string | null {
    const store = textOf(row.store_name);
    if (store !== "" && store !== name) return store;
    return null;
}

export async function searchCustomers(input: DirectorySearchInput): Promise<DirectoryPage<CustomerDirectoryItem>> {
    const { query, page, limit } = normalizedInput(input);
    const path =
        `/items/customer?fields=${CUSTOMER_DIRECTORY_FIELDS}` +
        `&sort=customer_name&limit=${limit}&page=${page}&meta=filter_count` +
        customerSearchClause(query);
    const body = await dFetch(path);
    const failure = describeDirectusErrors(body);
    if (failure !== null) throw new Error(`Customer directory search failed: ${failure}`);
    const rows = unwrapStudioGroupsData<CustomerDirectoryRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    const items: CustomerDirectoryItem[] = [];
    for (const row of list) {
        if (typeof row.id !== "number" || !Number.isInteger(row.id)) continue;
        const email = resolveCustomerEmail(row.customer_email);
        const name = customerName(row, email);
        items.push({
            ref: row.id,
            name,
            subtitle: customerSubtitle(row, name),
            email,
            active: row.isActive === true || row.isActive === 1,
            selectable: email !== null,
            reason: email === null ? "No email on file" : null,
        });
    }
    return { items, total: readFilterCount(body, items.length), page, pageSize: limit };
}
