"use client";

import { useCallback, useEffect, useState } from "react";

import { listMailOutbox, type MailOutboxRow } from "../providers/mailOutboxService";
import type { MailOutboxStatus } from "../types/mail-outbox.schema";

// Clean hook interface for the mailing UI (todo 8): read-only outbox viewer
// over the todo-7 routes. No resend/retry exists by design (D17).

/**
 * Loads masked outbox rows with an optional status filter. Status is
 * caller-owned (the module tabs row) so the filter bar can live outside
 * the viewer; the hook refetches whenever it changes.
 * @param status - Server-side status filter ("" = all).
 * @returns Outbox rows + loading/error/refresh helpers.
 */
export function useMailOutbox(status: MailOutboxStatus | "" = "") {
    const [rows, setRows] = useState<MailOutboxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (next?: MailOutboxStatus | "") => {
        const filter = next ?? "";
        setLoading(true);
        setError(null);
        try {
            const result = await listMailOutbox(filter);
            if (!result.success) {
                setError(result.message ?? "Failed to list outbox");
                setRows([]);
                return;
            }
            setRows(result.data ?? []);
        } catch {
            setError("Failed to list outbox. Please try again later.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh(status);
    }, [refresh, status]);

    return { rows, loading, error, refresh };
}
