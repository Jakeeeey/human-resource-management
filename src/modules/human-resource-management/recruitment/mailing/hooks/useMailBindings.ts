"use client";

import { useCallback, useEffect, useState } from "react";

import {
    createMailBinding,
    deleteMailBinding,
    listMailBindings,
    updateMailBinding,
    type MailBindingInput,
    type MailBindingRow,
} from "../providers/mailBindingService";

// Clean hook interface for the mailing UI (todo 8) and todo 10/12
// consumers (Send-now affordance plugs in via the optional onSendNow prop
// on the manager component — no dispatch is built here).

/**
 * Loads and mutates hook bindings.
 * @returns Bindings state + CRUD helpers.
 */
export function useMailBindings() {
    const [bindings, setBindings] = useState<MailBindingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [mutating, setMutating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listMailBindings();
            if (!result.success) {
                setError(result.message ?? "Failed to list bindings");
                setBindings([]);
                return;
            }
            setBindings(result.data ?? []);
        } catch {
            setError("Failed to list bindings. Please try again later.");
            setBindings([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createBinding = useCallback(async (input: MailBindingInput) => {
        setMutating(true);
        try {
            const result = await createMailBinding(input);
            if (!result.success) return { ok: false as const, message: result.message ?? "Create failed" };
            await refresh();
            return { ok: true as const, row: result.data as MailBindingRow };
        } finally {
            setMutating(false);
        }
    }, [refresh]);

    const toggleBinding = useCallback(async (id: string | number, is_enabled: boolean) => {
        setMutating(true);
        try {
            const result = await updateMailBinding(id, { is_enabled });
            if (!result.success) return { ok: false as const, message: result.message ?? "Update failed" };
            await refresh();
            return { ok: true as const };
        } finally {
            setMutating(false);
        }
    }, [refresh]);

    const unhookBinding = useCallback(async (id: string | number) => {
        setMutating(true);
        try {
            const result = await deleteMailBinding(id);
            if (!result.success) return { ok: false as const, message: result.message ?? "Unhook failed" };
            await refresh();
            return { ok: true as const };
        } finally {
            setMutating(false);
        }
    }, [refresh]);

    return { bindings, loading, mutating, error, refresh, createBinding, toggleBinding, unhookBinding };
}
