"use client";

import { useCallback, useEffect, useState } from "react";

import {
    createMailTemplate,
    listMailTemplates,
    updateMailTemplate,
    type MailTemplateInput,
    type MailTemplateRow,
} from "../providers/mailTemplateService";

// Clean hook interface for the mailing UI (todo 8) and todo 10 consumers:
// components call this hook, the hook calls the provider fetch wrappers,
// providers call the todos-5-7 routes (never Directus from the client).

/**
 * Loads and mutates mail templates.
 * @returns Templates state + CRUD helpers.
 */
export function useMailTemplates() {
    const [templates, setTemplates] = useState<MailTemplateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listMailTemplates();
            if (!result.success) {
                setError(result.message ?? "Failed to list templates");
                setTemplates([]);
                return;
            }
            setTemplates(result.data ?? []);
        } catch {
            setError("Failed to list templates. Please try again later.");
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const saveTemplate = useCallback(async (input: MailTemplateInput, id?: string | number) => {
        setSaving(true);
        try {
            const result =
                id === undefined ? await createMailTemplate(input) : await updateMailTemplate(id, input);
            if (!result.success) return { ok: false as const, message: result.message ?? "Save failed" };
            await refresh();
            return { ok: true as const, row: result.data as MailTemplateRow };
        } finally {
            setSaving(false);
        }
    }, [refresh]);

    return { templates, loading, saving, error, refresh, saveTemplate };
}
