import { useCallback, useEffect, useRef, useState } from "react";

import { saveDesign, type DesignSavePayload } from "../providers/designService";

import { useCanvasDoc } from "./useCanvasDoc";

// T10 client autosave: debounced (1.5s) write of the canvas doc + template meta
// through designService (→ /api/hrm/mailing-studio/templates, route lands T4).
// Explicit save() flushes immediately and cancels the pending timer.
// Compile-on-save (body_html/body_text via export-service) is intentionally NOT
// wired here — it lands with T4/T6. Never writes mail_outbox.

export type DesignAutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseDesignAutosaveOptions {
    templateKey: string;
    templateName: string;
    subject: string;
}

export interface UseDesignAutosaveResult {
    status: DesignAutosaveStatus;
    error: string | null;
    save: () => Promise<boolean>;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Serializes the live canvas store into the persisted design_json document.
 * The store partializes to {nodes, rootIds} only — the full doc adds the format
 * version (1) and the 600px stage width per the canvas-doc contract.
 * @returns Stringified CanvasDoc for ms_templates.design_json.
 */
function snapshotDesignJson(): string {
    const state = useCanvasDoc.getState();
    return JSON.stringify({
        version: 1,
        width: 600,
        nodes: state.nodes,
        rootIds: state.rootIds,
    });
}

/**
 * Debounced design autosave + explicit save for the studio page.
 * @param options - Stable template meta (key/name/subject) persisted with the doc.
 * @returns status (idle/saving/saved/error), last error, and save().
 */
export function useDesignAutosave(options: UseDesignAutosaveOptions): UseDesignAutosaveResult {
    const [status, setStatus] = useState<DesignAutosaveStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const save = useCallback(async (): Promise<boolean> => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setStatus("saving");
        setError(null);
        try {
            const payload: DesignSavePayload = {
                template_key: options.templateKey,
                template_name: options.templateName,
                subject: options.subject,
                design_json: snapshotDesignJson(),
                is_active: true,
            };
            await saveDesign(payload);
            setStatus("saved");
            return true;
        } catch (cause) {
            setStatus("error");
            setError(cause instanceof Error ? cause.message : String(cause));
            return false;
        }
    }, [options]);

    // Autosave on doc change: version bumps on every store mutation (add/move/
    // resize/remove/undo/redo), while selection/hover/viewport leave it alone.
    useEffect(() => {
        let lastVersion = useCanvasDoc.getState().version;
        const unsubscribe = useCanvasDoc.subscribe((state) => {
            if (state.version === lastVersion) return;
            lastVersion = state.version;
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                void save();
            }, AUTOSAVE_DEBOUNCE_MS);
        });
        return () => {
            unsubscribe();
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [save]);

    return { status, error, save };
}
