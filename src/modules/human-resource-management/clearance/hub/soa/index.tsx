"use client";

import { Suspense, useMemo } from "react";
import type { JSX } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { SoaEditor } from "./components/SoaEditor";

function ClearanceSoaModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const params = useParams();
    const requestParam = searchParams.get("request");
    const printParam = searchParams.get("print");
    const activeRequestId = useMemo(() => {
        const fromQuery = Number(requestParam);
        if (requestParam !== null && Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;
        const routeValue = params.requestId;
        const routeText = Array.isArray(routeValue) ? routeValue[0] : routeValue;
        const fromRoute = Number(routeText);
        if (typeof routeText === "string" && Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute;
        return null;
    }, [requestParam, params]);
    const printRequested = activeRequestId !== null && printParam === "1";

    if (activeRequestId === null) {
        return (
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    Statement of Account
                </h1>
                <p className="text-muted-foreground">
                    No clearance request is selected for this statement of account. Open this tab from a clearance workspace request.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SoaEditor requestId={activeRequestId} autoPrint={printRequested} />
        </div>
    );
}

export default function ClearanceSoaModule(): JSX.Element {
    return (
        <Suspense>
            <ClearanceSoaModuleInner />
        </Suspense>
    );
}
