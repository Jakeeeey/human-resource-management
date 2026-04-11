"use client";

/**
 * Salesman Creation fetch provider
 * Centralizes all API calls for the salesman-creation module.
 */

import type {
	Branch,
	Division,
	Operation,
	PriceType,
	SalesmanWithRelations,
	User,
} from "../types";

const API_BASE =
	"/api/hrm/employee-admin/structure/sales-management/salesman-creation";

export interface SalesmanCreationDataResponse {
	salesmen: SalesmanWithRelations[];
	users: User[];
	divisions: Division[];
	branches: Branch[];
	badBranches: Branch[];
	operations: Operation[];
	priceTypes: PriceType[];
}

async function http<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
	const res = await fetch(input, {
		...init,
		headers: {
			...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
			...(init?.headers ?? {}),
		},
		credentials: "include",
		cache: "no-store",
	});

	const text = await res.text();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let json: any = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}

	if (!res.ok) {
		const msg =
			json?.message ||
			json?.error ||
			(typeof json === "string" ? json : "") ||
			text ||
			`Request failed (${res.status})`;
		throw new Error(msg);
	}

	return (json ?? (text as unknown)) as T;
}

export async function getSalesmanCreationData() {
	return http<SalesmanCreationDataResponse>(API_BASE);
}

export async function createSalesman(data: Record<string, unknown>) {
	return http<unknown>(API_BASE, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateSalesman(id: number, data: Record<string, unknown>) {
	return http<unknown>(API_BASE, {
		method: "PATCH",
		body: JSON.stringify({ id, ...data }),
	});
}

export async function deleteSalesman(id: number) {
	const url = `${API_BASE}?id=${encodeURIComponent(String(id))}`;
	return http<unknown>(url, { method: "DELETE" });
}
