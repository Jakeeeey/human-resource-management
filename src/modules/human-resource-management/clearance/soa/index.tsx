"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
                    router.replace(pathname, { scroll: false });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeRequestId, pathname, router]);

    const handleOpen = useCallback((requestId: number) => {
        router.replace(`${pathname}?request=${requestId}`, { scroll: false });
    }, [router, pathname]);

    const handleBack = useCallback(() => {
        setConfirmedId(null);
        router.replace(pathname, { scroll: false });
    }, [router, pathname]);

    if (activeRequestId !== null && confirmedId === activeRequestId) {
        return (
            <div className="mx-auto w-full max-w-5xl space-y-4">
                <SoaEditor requestId={activeRequestId} autoPrint={printRequested} onBack={handleBack} />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4">
            <SoaList selectedRequestId={activeRequestId} onOpen={handleOpen} />
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
