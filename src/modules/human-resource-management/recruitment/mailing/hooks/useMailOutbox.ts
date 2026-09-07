"use client";

import { useCallback, useEffect, useState } from "react";

import { listMailOutbox, type MailOutboxRow } from "../providers/mailOutboxService";
import type { MailOutboxStatus } from "../types/mail-outbox.schema";

// Clean hook interface for the mailing UI (todo 8): read-only outbox viewer
// over the todo-7 routes. No resend/retry exists by design (D17).

/**
 * Loads masked outbox rows with an optional status filter.
 * @returns Outbox state + filter + refresh helpers.
 */
export function useMailOutbox() {
    const [rows, setRows] = useState<MailOutboxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<MailOutboxStatus | "">("");

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

    return { rows, loading, error, status, setStatus, refresh };
}
