"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSalesmanFilterContext } from "../Provider/SalesmanFilterProvider";
import type {
    SalesmanWithRelations,
    User,
    Division,
    Branch,
    Operation,
    PriceType,
} from "../types";

interface UseSalesmenReturn {
    salesmen: SalesmanWithRelations[];
    users: User[];
    divisions: Division[];
    branches: Branch[];
    badBranches: Branch[];
    operations: Operation[];
    priceTypes: PriceType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createSalesman: (data: Record<string, unknown>) => Promise<void>;
    updateSalesman: (id: number, data: Record<string, unknown>) => Promise<void>;
    deleteSalesman: (id: number) => Promise<void>;
}

export function useSalesmen(): UseSalesmenReturn {
    const { filters } = useSalesmanFilterContext();

    const [allSalesmen, setAllSalesmen] = useState<SalesmanWithRelations[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [badBranches, setBadBranches] = useState<Branch[]>([]);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [priceTypes, setPriceTypes] = useState<PriceType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const hasLoadedRef = useRef(false);

    const fetchData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading || !hasLoadedRef.current) {
                setIsLoading(true);
            }

            const res = await fetch("/api/hrm/employee-admin/structure/sales-management/salesman-creation", {
                cache: "no-store"
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const data = await res.json();
            setAllSalesmen(data.salesmen || []);
            setUsers(data.users || []);
            setDivisions(data.divisions || []);
            setBranches(data.branches || []);
            setBadBranches(data.badBranches || []);
            setOperations(data.operations || []);
            setPriceTypes(data.priceTypes || []);
            hasLoadedRef.current = true;

        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        const handleFocus = () => fetchData(false);
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    const filteredSalesmen = useMemo(() => {
        let result = [...allSalesmen];

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(
                (s) =>
                    s.salesman_name.toLowerCase().includes(searchLower) ||
                    s.salesman_code.toLowerCase().includes(searchLower) ||
                    (s.employee?.user_fname.toLowerCase().includes(searchLower)) ||
                    (s.employee?.user_lname.toLowerCase().includes(searchLower)) ||
                    (s.truck_plate?.toLowerCase().includes(searchLower))
            );
        }

        if (filters.priceType) {
            result = result.filter((s) => s.price_type === filters.priceType);
        }

        if (filters.isActive !== null) {
            result = result.filter((s) => (s.isActive === 1) === filters.isActive);
        }

        return result;
    }, [allSalesmen, filters]);

    const createSalesman = useCallback(
        async (data: Record<string, unknown>) => {
            const res = await fetch("/api/hrm/employee-admin/structure/sales-management/salesman-creation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = (await res.json().catch(() => null)) as
                    | { error?: string; message?: string }
                    | null;
                const message = errorData?.message || errorData?.error || "Failed to create salesman";
                throw new Error(message);
            }

            await fetchData(false);
        },
        [fetchData]
    );

    const updateSalesman = useCallback(
        async (id: number, data: Record<string, unknown>) => {
            const res = await fetch("/api/hrm/employee-admin/structure/sales-management/salesman-creation", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });

            if (!res.ok) {
                const errorData = (await res.json().catch(() => null)) as
                    | { error?: string; message?: string }
                    | null;
                const message = errorData?.message || errorData?.error || "Failed to update salesman";
                throw new Error(message);
            }

            await fetchData(false);
        },
        [fetchData]
    );

    const deleteSalesman = useCallback(
        async (id: number) => {
            const res = await fetch(`/api/hrm/employee-admin/structure/sales-management/salesman-creation?id=${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const errorData = (await res.json().catch(() => null)) as
                    | { error?: string; message?: string }
                    | null;
                const message = errorData?.message || errorData?.error || "Failed to delete salesman";
                throw new Error(message);
            }

            await fetchData(false);
        },
        [fetchData]
    );

    return {
        salesmen: filteredSalesmen,
        users,
        divisions,
        branches,
        badBranches,
        operations,
        priceTypes,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        createSalesman,
        updateSalesman,
        deleteSalesman,
    };
}
