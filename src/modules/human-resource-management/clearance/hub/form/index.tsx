"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import type { JSX } from "react";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ClearanceFormList } from "./components/ClearanceFormList";
import { ClearanceWorkspace } from "./components/ClearanceWorkspace";
import { useClearanceForms, type ClearanceFormStatusFilter } from "./hooks/useClearanceForms";
import type { ClearanceFormOverview } from "./types";

function ClearanceFormModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const requestParam = searchParams.get("request");
    const printParam = searchParams.get("print");
    const {
        rows,
        total,
        page,
        totalPages,
        status,
        changeStatus,
        goToPage,
        isLoading,
        error,
        refresh,
    } = useClearanceForms();
    const [nameCache, setNameCache] = useState<{ id: number; name: string } | null>(null);

    const activeRequestId = useMemo(() => {
        const fromQuery = Number(requestParam);
        if (requestParam !== null && Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;
        const routeValue = params.requestId;
        const routeText = Array.isArray(routeValue) ? routeValue[0] : routeValue;
        const fromRoute = Number(routeText);
        if (typeof routeText === "string" && Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute;
        return null;
    }, [requestParam, params]);

    const closeWorkspace = useCallback(() => {
        setNameCache(null);
        router.replace(`${pathname}?tab=form`, { scroll: false });
    }, [router, pathname]);

    function handleSelect(row: ClearanceFormOverview): void {
        setNameCache({ id: row.request_id, name: row.employee_name });
        router.replace(`${pathname}?tab=form&request=${row.request_id}`, { scroll: false });
    }

    if (activeRequestId !== null) {
        return (
            <ClearanceWorkspace
                requestId={activeRequestId}
                employeeName={nameCache !== null && nameCache.id === activeRequestId ? nameCache.name : null}
                onBack={closeWorkspace}
                onChanged={refresh}
                autoPrint={printParam === "1"}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Clearance Form
                    </h1>
                    <p className="text-muted-foreground">
                        Approve and print employee clearance forms
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={status}
                    onValueChange={(value) => changeStatus(value as ClearanceFormStatusFilter)}
                >
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                </Select>

                <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                    Showing <span className="font-semibold">{rows.length}</span>{" "}
                    of <span className="font-semibold">{total}</span> clearance{" "}
                    {total === 1 ? "form" : "forms"}
                </p>
            </div>

            <ClearanceFormList
                rows={rows}
                total={total}
                page={page}
                totalPages={totalPages}
                status={status}
                selectedRequestId={activeRequestId}
                isLoading={isLoading}
                error={error}
                onSelect={handleSelect}
                onPageChange={goToPage}
                onRetry={refresh}
            />
        </div>
    );
}

export default function ClearanceFormModule(): JSX.Element {
    return (
        <Suspense>
            <ClearanceFormModuleInner />
        </Suspense>
    );
}
