"use client";

import { useEffect, useRef } from "react";

export interface DialogFocusReturnHandlers {
    readonly onOpenAutoFocus: () => void;
    readonly onCloseAutoFocus: (event: Event) => void;
}

const TRANSIENT_LAYER_SELECTOR =
    "[role='menu'],[role='listbox'],[role='dialog'],[role='alertdialog'],[data-radix-popper-content-wrapper]";

const FOCUSABLE_SELECTOR = "button,a[href],input,select,textarea,[tabindex]";

let lastStableFocus: HTMLElement | null = null;
let trackerUsers = 0;

function resolveReturnTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    if (target.closest(TRANSIENT_LAYER_SELECTOR)) return null;
    const focusable = target.closest(FOCUSABLE_SELECTOR);
    if (!(focusable instanceof HTMLElement)) return null;
    if (focusable === document.body || focusable === document.documentElement) return null;
    return focusable;
}

function rememberStableFocus(event: Event): void {
    const element = resolveReturnTarget(event.target);
    if (element) lastStableFocus = element;
}

function acquireTracker(): () => void {
    if (trackerUsers === 0) {
        document.addEventListener("focusin", rememberStableFocus, true);
        document.addEventListener("pointerdown", rememberStableFocus, true);
    }
    trackerUsers += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        trackerUsers -= 1;
        if (trackerUsers === 0) {
            document.removeEventListener("focusin", rememberStableFocus, true);
            document.removeEventListener("pointerdown", rememberStableFocus, true);
        }
    };
}

export function useDialogFocusReturn(): DialogFocusReturnHandlers {
    const returnFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => acquireTracker(), []);

    return {
        onOpenAutoFocus: () => {
            const current = resolveReturnTarget(document.activeElement);
            returnFocusRef.current = current ?? lastStableFocus;
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
