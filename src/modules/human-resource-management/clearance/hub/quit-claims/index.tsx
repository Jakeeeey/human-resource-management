"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { QuitClaimEditor } from "./components/QuitClaimEditor";
import { createQuitClaim, loadCompanyOptions } from "./providers/quitClaimClient";
import { fetchEmployeeCompany, pickEmployeeCompany } from "../utils/company";

interface RequestOwner {
    userId: number;
    resignationId: number | null;
}

function toPositiveInt(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
    return value;
}

async function readRequestOwner(requestId: number): Promise<RequestOwner | null> {
    try {
        const res = await fetch(`/api/hrm/clearance/requests/${requestId}`);
        if (!res.ok) return null;
        const body: unknown = await res.json().catch(() => null);
        if (body === null || typeof body !== "object" || !("data" in body)) return null;
        const data = (body as { data: unknown }).data;
        if (data === null || typeof data !== "object") return null;
        const record = data as Record<string, unknown>;
        const userId = toPositiveInt(record.user_id);
        if (userId === null) return null;
        return { userId, resignationId: toPositiveInt(record.resignation_id) };
    } catch {
        return null;
    }
}

async function findClaimIdForRequest(userId: number, requestId: number): Promise<number | null> {
    try {
        const params = new URLSearchParams({ page: "1", limit: "100", user_id: String(userId) });
        const res = await fetch(`/api/hrm/clearance/quit-claims?${params.toString()}`);
        if (!res.ok) return null;
        const body: unknown = await res.json().catch(() => null);
        if (body === null || typeof body !== "object" || !("data" in body)) return null;
        const data = (body as { data: unknown }).data;
        if (!Array.isArray(data)) return null;
        for (const entry of data) {
            if (entry === null || typeof entry !== "object") continue;
            const record = entry as Record<string, unknown>;
            const id = toPositiveInt(record.id);
            if (id !== null && record.request_id === requestId) return id;
        }
        return null;
    } catch {
        return null;
    }
}

function QuitClaimDetailSkeleton(): JSX.Element {
    return (
        <div className="space-y-2" aria-label="Loading quit claim">
            {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
            ))}
        </div>
    );
}

function QuitClaimUnavailable(): JSX.Element {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="font-medium">No quit claim to display.</p>
            <p className="text-sm text-muted-foreground">
                Open this tab from a clearance request workspace to view its quit claim.
            </p>
        </div>
    );
}

function ClearanceQuitClaimsModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
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

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const linkedForRef = useRef<number | null>(null);
    const resolvingRef = useRef<number | null>(null);

    function handleEditorOpenChange(next: boolean): void {
        setEditorOpen(next);
        if (!next && searchParams.get("request") !== null) {
            router.replace(`${pathname}?tab=quit-claims`, { scroll: false });
        }
    }

    useEffect(() => {
        if (activeRequestId === null) return;
        if (linkedForRef.current === activeRequestId) return;
        if (resolvingRef.current === activeRequestId) return;
        resolvingRef.current = activeRequestId;
        let cancelled = false;
        (async () => {
            const owner = await readRequestOwner(activeRequestId);
            if (cancelled) return;
            if (owner === null) {
                linkedForRef.current = activeRequestId;
                router.replace(`${pathname}?tab=quit-claims`, { scroll: false });
                return;
            }
            const existingId = await findClaimIdForRequest(owner.userId, activeRequestId);
            if (cancelled) return;
            if (existingId !== null) {
                linkedForRef.current = activeRequestId;
                setSelectedId(existingId);
                setEditorOpen(true);
                return;
            }
            try {
                let companyName: string | undefined;
                try {
                    const [options, employee] = await Promise.all([
                        loadCompanyOptions(),
                        fetchEmployeeCompany({ userId: owner.userId }),
                    ]);
                    if (cancelled) return;
                    const match = pickEmployeeCompany(options, employee.company_id);
                    if (match) companyName = match.company_name;
                } catch {
                    companyName = undefined;
                }
                if (cancelled) return;
                const created = await createQuitClaim({
                    user_id: owner.userId,
                    resignation_id: owner.resignationId,
                    request_id: activeRequestId,
                    company_name: companyName,
                });
                if (cancelled) return;
                linkedForRef.current = activeRequestId;
                setSelectedId(created.id);
                setEditorOpen(true);
            } catch {
                if (!cancelled) {
                    linkedForRef.current = activeRequestId;
                    toast.error("Could not open a quit claim for this clearance request.");
                    router.replace(`${pathname}?tab=quit-claims`, { scroll: false });
                }
            }
        })();
        return () => {
            cancelled = true;
            if (resolvingRef.current === activeRequestId) resolvingRef.current = null;
        };
    }, [activeRequestId, pathname, router]);

    return (
        <div className="space-y-6">
            {editorOpen ? (
                <QuitClaimEditor
                    quitclaimId={selectedId}
                    open={editorOpen}
                    onOpenChange={handleEditorOpenChange}
                    onChanged={() => undefined}
                    autoOpenPrint={printRequested}
                />
            ) : activeRequestId !== null ? (
                <QuitClaimDetailSkeleton />
            ) : (
                <QuitClaimUnavailable />
            )}
        </div>
    );
}

export default function ClearanceQuitClaimsModule(): JSX.Element {
    return (
        <Suspense>
            <ClearanceQuitClaimsModuleInner />
        </Suspense>
    );
}
