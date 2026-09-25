import { useCallback, useEffect, useRef, useState } from "react";

import { saveDesign, type DesignSavePayload } from "../../providers/designService";

import { useCanvasDoc } from "./useCanvasDoc";

// Manual-save-only persistence (P1-5 follow-up): the 1.5s auto-persist path is
// OFF. Edits only mark dirty; the Save button (+ Ctrl+S, wired in
// MailingStudioPage) is the sole writer through designService
// (→ /api/hrm/mailing-studio/templates). Mount hydration never marks dirty
// (hydrate bumps no version). Compile-on-save (body_html/body_text via
// export-service) is intentionally NOT wired here. Never writes mail_outbox.

export type DesignAutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseDesignAutosaveOptions {
    templateKey: string;
    templateName: string;
    subject: string;
}

export interface DesignSaveResult {
    ok: boolean;
    message: string | null;
}

export interface UseDesignAutosaveResult {
    status: DesignAutosaveStatus;
    error: string | null;
    message: string | null;
    dirty: boolean;
    save: () => Promise<DesignSaveResult>;
}

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
 * Manual-save persistence + dirty tracking for the studio page.
 * @param options - Stable template meta (key/name/subject) persisted with the doc.
 * @returns status (idle/saving/saved/error), last error, envelope message,
 * dirty flag, and save() — the only writer.
 */
export function useDesignAutosave(options: UseDesignAutosaveOptions): UseDesignAutosaveResult {
    const [status, setStatus] = useState<DesignAutosaveStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [savedMeta, setSavedMeta] = useState(options);
    const savedVersionRef = useRef<number | null>(null);

    const save = useCallback(async (): Promise<DesignSaveResult> => {
        const versionAtSave = useCanvasDoc.getState().version;
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
            const { message: envelopeMessage } = await saveDesign(payload);
            setMessage(envelopeMessage);
            savedVersionRef.current = versionAtSave;
            setSavedMeta(options);
            // Edits landing mid-flight stay dirty instead of being swallowed.
            setDirty(useCanvasDoc.getState().version !== versionAtSave);
            setStatus("saved");
            return { ok: true, message: envelopeMessage };
        } catch (cause) {
            setStatus("error");
            setError(cause instanceof Error ? cause.message : String(cause));
            return { ok: false, message: null };
        }
    }, [options]);

    // Dirty on doc change: version bumps on every store mutation (add/move/
    // resize/remove/undo/redo), while selection/hover/viewport/hydration leave
    // it alone. No write happens here — save() is the only writer.
    useEffect(() => {
        if (savedVersionRef.current === null) {
            savedVersionRef.current = useCanvasDoc.getState().version;
        }
        const unsubscribe = useCanvasDoc.subscribe((state) => {
            if (state.version !== savedVersionRef.current) setDirty(true);
        });
        return unsubscribe;
    }, []);

    const metaDirty =
        savedMeta.templateKey !== options.templateKey ||
        savedMeta.templateName !== options.templateName ||
        savedMeta.subject !== options.subject;

    return { status, error, message, dirty: dirty || metaDirty, save };
}
