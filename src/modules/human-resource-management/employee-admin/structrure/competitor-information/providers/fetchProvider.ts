"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Competitor, CompetitorFormData, PsgcItem } from "../types";

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";
const PSGC_CACHE = new Map<string, PsgcItem[]>();

async function fetchPsgcList(path: string): Promise<PsgcItem[]> {
	if (PSGC_CACHE.has(path)) {
		return PSGC_CACHE.get(path) || [];
	}

	try {
		const res = await fetch(`${PSGC_BASE_URL}${path}`);
		if (!res.ok) throw new Error("PSGC fetch failed");
		const data = await res.json();
		const list = Array.isArray(data) ? data : [];
		PSGC_CACHE.set(path, list);
		return list;
	} catch {
		return [];
	}
}

export function fetchPsgcProvinces(): Promise<PsgcItem[]> {
	return fetchPsgcList("/provinces/");
}

export function fetchPsgcCitiesByProvince(provinceCode: string): Promise<PsgcItem[]> {
	if (!provinceCode) return Promise.resolve([]);
	return fetchPsgcList(`/provinces/${provinceCode}/cities-municipalities/`);
}

export function fetchPsgcBarangaysByCity(cityCode: string): Promise<PsgcItem[]> {
	if (!cityCode) return Promise.resolve([]);
	return fetchPsgcList(`/cities-municipalities/${cityCode}/barangays/`);
}

interface CompetitorFetchContextType {
	competitors: Competitor[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
	createCompetitor: (data: CompetitorFormData) => Promise<void>;
	updateCompetitor: (id: number, data: CompetitorFormData) => Promise<void>;
}

const CompetitorFetchContext = createContext<CompetitorFetchContextType | undefined>(
	undefined
);

export function CompetitorInformationFetchProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactNode {
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);
			setIsError(false);

			const res = await fetch(
				"/api/hrm/employee-admin/structure/competitor-information",
				{ cache: "no-store" }
			);

			if (!res.ok) throw new Error("Fetch failed");

			const data = await res.json();
			setCompetitors(data.competitors || []);
		} catch (err) {
			setIsError(true);
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const createCompetitor = useCallback(
		async (data: CompetitorFormData) => {
			const res = await fetch(
				"/api/hrm/employee-admin/structure/competitor-information",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(data),
				}
			);
			if (!res.ok) throw new Error("Create failed");
			await fetchData();
		},
		[fetchData]
	);

	const updateCompetitor = useCallback(
		async (id: number, data: CompetitorFormData) => {
			const res = await fetch(
				"/api/hrm/employee-admin/structure/competitor-information",
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id, ...data }),
				}
			);
			if (!res.ok) throw new Error("Update failed");
			await fetchData();
		},
		[fetchData]
	);

	return React.createElement(
		CompetitorFetchContext.Provider,
		{
			value: {
				competitors,
				isLoading,
				isError,
				error,
				refetch: fetchData,
				createCompetitor,
				updateCompetitor,
			},
		},
		children
	);
}

export function useCompetitorFetchContext() {
	const ctx = useContext(CompetitorFetchContext);
	if (!ctx) {
		throw new Error("Must be used inside CompetitorInformationFetchProvider");
	}
	return ctx;
}
