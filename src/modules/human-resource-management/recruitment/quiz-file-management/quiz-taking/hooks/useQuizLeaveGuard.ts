"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PendingNav = { kind: "link"; href: string } | { kind: "back" } | null;

export function useQuizLeaveGuard(active: boolean) {
    const router = useRouter();
    const [pendingNav, setPendingNav] = useState<PendingNav>(null);
    const bypassPopRef = useRef(false);

    const confirmLeave = useCallback(() => {
        const nav = pendingNav;
        setPendingNav(null);
        if (!nav) return;
        if (nav.kind === "link") {
            router.push(nav.href);
        } else {
            bypassPopRef.current = true;
            window.history.back();
        }
    }, [pendingNav, router]);

    const clearPending = useCallback(() => setPendingNav(null), []);

    useEffect(() => {
        if (!active) return;

        function handleClick(e: MouseEvent) {
            const link = (e.target as HTMLElement).closest("a");
            const href = link?.getAttribute("href");
            if (!href || href.startsWith("#")) return;
            e.preventDefault();
            setPendingNav({ kind: "link", href });
        }
        document.addEventListener("click", handleClick, { capture: true });

        window.history.pushState(null, "", window.location.href);
        function handlePopState() {
            if (bypassPopRef.current) {
                bypassPopRef.current = false;
                return;
            }
            window.history.pushState(null, "", window.location.href);
            setPendingNav({ kind: "back" });
        }
        window.addEventListener("popstate", handlePopState);

        return () => {
            document.removeEventListener("click", handleClick, { capture: true });
            window.removeEventListener("popstate", handlePopState);
        };
    }, [active]);

    return { pendingNav, confirmLeave, clearPending };
}
