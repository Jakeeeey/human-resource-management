"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuitClaimCreateDialog } from "./components/QuitClaimCreateDialog";
import { QuitClaimEditor } from "./components/QuitClaimEditor";
import { QuitClaimList } from "./components/QuitClaimList";
import { createQuitClaim } from "./providers/quitClaimClient";

interface RequestOwner {
    userId: number;
    resignationId: number | null;
}

function parseRequestId(raw: string | null): number | null {
    if (raw === null) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
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

function ClearanceQuitClaimsModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const requestParam = searchParams.get("request");
    const printParam = searchParams.get("print");

    const activeRequestId = useMemo(() => parseRequestId(requestParam), [requestParam]);
    const printRequested = activeRequestId !== null && printParam === "1";

    const [createOpen, setCreateOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const linkedForRef = useRef<number | null>(null);
    const resolvingRef = useRef<number | null>(null);

    function handleOpen(id: number): void {
        setSelectedId(id);
        setEditorOpen(true);
    }

    function handleChanged(): void {
        setRefreshKey((current) => current + 1);
    }

    function handleEditorOpenChange(next: boolean): void {
        setEditorOpen(next);
        if (!next && searchParams.get("request") !== null) {
            router.replace(pathname, { scroll: false });
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
                router.replace(pathname, { scroll: false });
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
                const created = await createQuitClaim({
                    user_id: owner.userId,
                    resignation_id: owner.resignationId,
                    request_id: activeRequestId,
                });
                if (cancelled) return;
                linkedForRef.current = activeRequestId;
                setRefreshKey((current) => current + 1);
                setSelectedId(created.id);
                setEditorOpen(true);
            } catch {
                if (!cancelled) {
                    linkedForRef.current = activeRequestId;
                    toast.error("Could not open a quit claim for this clearance request.");
                    router.replace(pathname, { scroll: false });
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quit Claims</h1>
                    <p className="text-muted-foreground">
                        Standalone fillable quit claims — all amounts are manual entry
                    </p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New quit claim
                </Button>
            </div>
            <QuitClaimList refreshKey={refreshKey} onOpen={handleOpen} />
            <QuitClaimCreateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(detail: { id: number }) => {
                    setCreateOpen(false);
                    handleChanged();
                    handleOpen(detail.id);
                }}
            />
            <QuitClaimEditor
                quitclaimId={selectedId}
                open={editorOpen}
                onOpenChange={handleEditorOpenChange}
                onChanged={handleChanged}
                autoOpenPrint={printRequested}
            />
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
