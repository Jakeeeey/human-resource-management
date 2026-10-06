"use client";

import { useRef } from "react";

export interface DialogFocusReturnHandlers {
    readonly onOpenAutoFocus: () => void;
    readonly onCloseAutoFocus: (event: Event) => void;
}

export function useDialogFocusReturn(): DialogFocusReturnHandlers {
    const returnFocusRef = useRef<HTMLElement | null>(null);
    return {
        onOpenAutoFocus: () => {
            const active = document.activeElement;
            returnFocusRef.current = active instanceof HTMLElement ? active : null;
        },
        onCloseAutoFocus: (event: Event) => {
            const target = returnFocusRef.current;
            returnFocusRef.current = null;
            if (target && target.isConnected) {
                event.preventDefault();
                target.focus();
            }
        },
    };
}
