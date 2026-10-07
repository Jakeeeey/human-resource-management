"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

import { SoaEditor } from "./components/SoaEditor";
import { SoaList } from "./components/SoaList";

function parseRequestId(raw: string | null): number | null {
    if (raw === null) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function ClearanceSoaModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const requestParam = searchParams.get("request");
    const printParam = searchParams.get("print");

    const activeRequestId = useMemo(() => parseRequestId(requestParam), [requestParam]);
    const printRequested = activeRequestId !== null && printParam === "1";

    const [confirmedId, setConfirmedId] = useState<number | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);

    useEffect(() => {
        if (activeRequestId === null) {
            setConfirmedId(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/soa/by-request?request_id=${activeRequestId}`);
                if (!res.ok) throw new Error(`No statement of account for request ${activeRequestId}.`);
                if (!cancelled) setConfirmedId(activeRequestId);
            } catch {
                if (!cancelled) {
                    setConfirmedId(null);
                    router.replace(`${pathname}?tab=soa`, { scroll: false });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeRequestId, pathname, router]);

    const handleOpen = useCallback((requestId: number) => {
        router.replace(`${pathname}?tab=soa&request=${requestId}`, { scroll: false });
    }, [router, pathname]);

    const handleBack = useCallback(() => {
        setConfirmedId(null);
        router.replace(`${pathname}?tab=soa`, { scroll: false });
    }, [router, pathname]);

    const handleRefresh = useCallback(() => {
        setRefreshSignal((signal) => signal + 1);
    }, []);

    if (activeRequestId !== null && confirmedId === activeRequestId) {
        return (
            <div className="space-y-6">
                <SoaEditor requestId={activeRequestId} autoPrint={printRequested} onBack={handleBack} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Statements of Account
                    </h1>
                    <p className="text-muted-foreground">
                        Issue and print employee statements of account
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        className="gap-2"
                    >
                        Refresh
                    </Button>
                </div>
            </div>
            <SoaList selectedRequestId={activeRequestId} onOpen={handleOpen} refreshSignal={refreshSignal} />
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
