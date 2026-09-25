"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { fetchMsTemplate, type DesignRow } from "../providers/msTemplates";
import { normaliseVariablesList } from "../utils/ms-variables";

/**
 * Template detail — reads one ms_templates row by numeric id or template_key
 * via the real by-id route. Shows the row meta and routes into the designer
 * with the row key (?key=); the canvas lane hydrates the designer from that
 * key. Honest not-found state when the id names nothing.
 */
export function TemplateDetail({ id }: { readonly id: string }) {
    const [row, setRow] = useState<DesignRow | null>(null);
    const [missing, setMissing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            setError(null);
            setMissing(false);
            try {
                const data = await fetchMsTemplate(id);
                if (cancelled) return;
                if (!data) setMissing(true);
                else setRow(data);
            } catch (cause) {
                if (cancelled) return;
                const message = cause instanceof Error ? cause.message : String(cause);
                if (/not found/i.test(message)) setMissing(true);
                else setError(message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (isLoading) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2" data-testid="template-detail-loading" role="status" aria-label="Loading template">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <span className="sr-only">Loading template…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-lg border border-destructive/40 bg-card p-4"
                data-testid="template-detail-error"
                role="alert"
            >
                <p className="text-sm text-destructive">{error}</p>
                <div>
                    <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" asChild>
                        <Link href="/hrm/mailing-studio/templates">Back to templates</Link>
                    </Button>
                </div>
            </div>
        );
    }

    if (missing || !row) {
        return (
            <div
                className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-lg border bg-card py-16 text-center"
                data-testid="template-detail-empty"
            >
                <p className="text-sm text-muted-foreground">No template found for “{id}”.</p>
                <Button className="min-h-11 md:min-h-0" size="sm" asChild>
                    <Link href="/hrm/mailing-studio/templates/new">Create a template</Link>
                </Button>
            </div>
        );
    }

    const active = row.is_active === true || row.is_active === 1;
    const variables = normaliseVariablesList(row.variables);

    return (
        <section
            aria-label="Template detail"
            className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-lg border bg-card p-4"
            data-testid="template-detail"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={row.template_name}>
                    {row.template_name}
                </h2>
                <Badge variant={active ? "default" : "outline"}>{active ? "Active" : "Retired"}</Badge>
            </div>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="font-medium text-muted-foreground">Template key</dt>
                    <dd className="truncate font-mono tabular-nums" title={row.template_key}>{row.template_key}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="font-medium text-muted-foreground">Subject</dt>
                    <dd className="truncate" title={row.subject}>{row.subject}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="font-medium text-muted-foreground">Variables</dt>
                    <dd className="tabular-nums">
                        {variables.length === 0 ? "None" : variables.join(", ")}
                    </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="font-medium text-muted-foreground">Updated</dt>
                    <dd className="truncate tabular-nums" title={row.updated_at ?? undefined}>{row.updated_at ?? "—"}</dd>
                </div>
            </dl>
            <div className="flex flex-wrap gap-2">
                <Button aria-label={`Open in designer: ${row.template_name}`} className="min-h-11 md:min-h-0" size="sm" asChild>
                    <Link href={`/hrm/mailing-studio?key=${encodeURIComponent(row.template_key)}`}>
                        Open in designer
                    </Link>
                </Button>
                <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" asChild>
                    <Link href="/hrm/mailing-studio/templates">Back to templates</Link>
                </Button>
            </div>
        </section>
    );
}
