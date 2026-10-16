"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import { TurnoverChecklistWorkspace } from "./components/TurnoverChecklistWorkspace";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toPositiveInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
}

async function resolveEmployeeName(requestId: number): Promise<string | null> {
    try {
        const res = await fetch(`/api/hrm/clearance/requests/${requestId}`, { cache: "no-store" });
        if (!res.ok) return null;
        const body: unknown = await res.json().catch(() => null);
        if (!isRecord(body) || !isRecord(body.data)) return null;
        const resignationId = toPositiveInt(body.data.resignation_id);
        if (resignationId === null) return null;
        const listRes = await fetch("/api/hrm/clearance/approved-resignations", { cache: "no-store" });
        if (!listRes.ok) return null;
        const listBody: unknown = await listRes.json().catch(() => null);
        if (!isRecord(listBody) || !Array.isArray(listBody.data)) return null;
        for (const entry of listBody.data) {
            if (!isRecord(entry)) continue;
            if (toPositiveInt(entry.id) !== resignationId) continue;
            return typeof entry.employee_name === "string" && entry.employee_name.trim() !== ""
                ? entry.employee_name
                : null;
        }
        return null;
    } catch {
        return null;
    }
}

function TurnoverDetailSkeleton(): JSX.Element {
    return (
        <div className="space-y-6" aria-label="Loading turnover checklist">
            {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-40 w-full" />
            ))}
        </div>
    );
}

function TurnoverUnavailable(): JSX.Element {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="font-medium">No turnover checklist to display.</p>
            <p className="text-sm text-muted-foreground">
                Open this tab from a clearance request workspace to view its turnover checklist.
            </p>
        </div>
    );
}

function ClearanceTurnoverModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const params = useParams();
    const { refresh } = useClearanceHubContext();
    const requestParam = searchParams.get("request");

    const activeRequestId = useMemo(() => {
        const fromQuery = Number(requestParam);
        if (requestParam !== null && Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;
        const routeValue = params.requestId;
        const routeText = Array.isArray(routeValue) ? routeValue[0] : routeValue;
        const fromRoute = Number(routeText);
        if (typeof routeText === "string" && Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute;
        return null;
    }, [requestParam, params]);

    const [nameCache, setNameCache] = useState<{ id: number; name: string | null } | null>(null);

    useEffect(() => {
        if (activeRequestId === null) return;
        let cancelled = false;
        (async () => {
            const name = await resolveEmployeeName(activeRequestId);
            if (!cancelled) setNameCache({ id: activeRequestId, name });
        })();
        return () => {
            cancelled = true;
        };
    }, [activeRequestId]);

    const handleChanged = useCallback(() => {
        void refresh();
    }, [refresh]);

    if (activeRequestId === null) {
        return (
            <div className="space-y-6">
                <TurnoverUnavailable />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <TurnoverChecklistWorkspace
                requestId={activeRequestId}
                employeeName={nameCache !== null && nameCache.id === activeRequestId ? nameCache.name : null}
                onChanged={handleChanged}
            />
        </div>
    );
}

export default function ClearanceTurnoverModule(): JSX.Element {
    return (
        <Suspense fallback={<TurnoverDetailSkeleton />}>
            <ClearanceTurnoverModuleInner />
        </Suspense>
    );
}
