"use client";

import { useCallback, useEffect, useRef } from "react";

export function useDialogTriggerFocus(open: boolean): () => void {
    const triggerRef = useRef<HTMLElement | null>(null);
    const previousRef = useRef(open);

    const captureTrigger = useCallback(() => {
        triggerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }, []);

    useEffect(() => {
        if (open) {
            previousRef.current = true;
            return undefined;
        }
        if (!previousRef.current) {
            return undefined;
        }
        previousRef.current = false;
        const element = triggerRef.current;
        triggerRef.current = null;
        if (element === null || !document.contains(element)) {
            return undefined;
        }
        const timer = window.setTimeout(() => {
            if (document.contains(element)) {
                element.focus();
            }
        }, 220);
        return () => window.clearTimeout(timer);
    }, [open]);

    return captureTrigger;
}
