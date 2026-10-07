"use client";

import { Suspense, useMemo } from "react";
import type { JSX } from "react";
import { useSearchParams } from "next/navigation";

import { SoaEditor } from "./components/SoaEditor";

function parseRequestId(raw: string | null): number | null {
    if (raw === null) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function ClearanceSoaModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const requestParam = searchParams.get("request");
    const printParam = searchParams.get("print");
    const activeRequestId = useMemo(() => parseRequestId(requestParam), [requestParam]);
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
