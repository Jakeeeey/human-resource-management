"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { IdNode, IdPage } from "../types/id-layout.schema";
import { IdViewerSide } from "./IdViewerSide";
import { buildIdViewerValues } from "./idViewerValues";
import {
    exportIdViewerPng,
    ID_VIEWER_IMAGE_PLACEHOLDER,
    idViewerExportFilename,
} from "./idViewerExport";
import {
    fetchIdViewerResolve,
    getIdViewerTemplate,
    listIdViewerTemplates,
} from "./idResolveClient";
import type {
    IdViewerResolveResponse,
    IdViewerTemplateSummary,
} from "./idResolveClient";

export interface IdViewerProps {
    readonly userId: number;
    readonly reloadToken?: number | string;
}

interface IdViewerDoc {
    readonly front: IdPage;
    readonly back: IdPage;
    readonly nodes: Readonly<Record<string, IdNode>>;
}

function toViewerDoc(raw: unknown): IdViewerDoc | null {
    let doc: unknown = raw;
    if (typeof doc === "string") {
        try {
            doc = JSON.parse(doc) as unknown;
        } catch {
            return null;
        }
    }
    if (typeof doc !== "object" || doc === null) return null;
    const record = doc as { pages?: unknown; nodes?: unknown };
    if (!Array.isArray(record.pages)) return null;
    if (typeof record.nodes !== "object" || record.nodes === null) return null;
    const pages = record.pages as Array<IdPage>;
    const front = pages.find((page) => page !== null && typeof page === "object" && page.side === "front");
    const back = pages.find((page) => page !== null && typeof page === "object" && page.side === "back");
    if (!front || !back) return null;
    return { front, back, nodes: record.nodes as Readonly<Record<string, IdNode>> };
}

export function IdViewer({ userId, reloadToken }: IdViewerProps) {
    const [resolve, setResolve] = useState<IdViewerResolveResponse | null>(null);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [templates, setTemplates] = useState<IdViewerTemplateSummary[]>([]);
    const [overrideId, setOverrideId] = useState<string>("auto");
    const [overrideDesign, setOverrideDesign] = useState<unknown>(null);
    const [overrideLoading, setOverrideLoading] = useState<boolean>(false);
    const [attempt, setAttempt] = useState<number>(0);
    const [exporting, setExporting] = useState<"front" | "back" | null>(null);
    const frontRef = useRef<HTMLDivElement>(null);
    const backRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        setResolve(null);
        setResolveError(null);
        async function load(): Promise<void> {
            try {
                const data = await fetchIdViewerResolve(userId);
                if (!cancelled) setResolve(data);
            } catch (error) {
                if (!cancelled) {
                    setResolveError(
                        error instanceof Error ? error.message : "ID card is unavailable right now."
                    );
                }
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [userId, reloadToken, attempt]);

    useEffect(() => {
        let cancelled = false;
        async function load(): Promise<void> {
            try {
                const rows = await listIdViewerTemplates();
                if (!cancelled) setTemplates(rows);
            } catch {
                if (!cancelled) setTemplates([]);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (overrideId === "auto") {
            setOverrideDesign(null);
            setOverrideLoading(false);
            return;
        }
        let cancelled = false;
        setOverrideLoading(true);
        async function load(): Promise<void> {
            try {
                const row = await getIdViewerTemplate(overrideId);
                if (!cancelled) setOverrideDesign(row ? (row.design_json ?? null) : null);
            } catch {
                if (!cancelled) setOverrideDesign(null);
            } finally {
                if (!cancelled) setOverrideLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [overrideId]);

    async function exportSide(side: "front" | "back", firstName: string, lastName: string) {
        const element = side === "front" ? frontRef.current : backRef.current;
        if (!element) return;
        setExporting(side);
        try {
            const dataUrl = await exportIdViewerPng(element, {
                imagePlaceholder: ID_VIEWER_IMAGE_PLACEHOLDER,
            });
            const link = document.createElement("a");
            link.download = idViewerExportFilename(side, firstName, lastName);
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error(`Could not export the ${side} side. Check the connection and try again.`);
        } finally {
            setExporting(null);
        }
    }

    if (resolveError !== null) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl bg-muted/20 p-10 text-center">
                <p className="text-sm font-semibold text-foreground">{resolveError}</p>
                <Button
                    className="h-10 rounded-xl px-6"
                    onClick={() => setAttempt((value) => value + 1)}
                    variant="outline"
                >
                    Retry
                </Button>
            </div>
        );
    }

    if (resolve === null || overrideLoading) {
        return (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl bg-muted/20 p-10">
                <p className="text-sm font-medium text-muted-foreground">Loading ID card…</p>
            </div>
        );
    }

    const design: unknown =
        overrideId === "auto"
            ? (resolve.template ? (resolve.template.design_json ?? null) : null)
            : overrideDesign;

    if (design === null || design === undefined) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/20 p-10 text-center">
                <p className="text-sm font-bold text-foreground">No ID template is assigned</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                    No template matches this employee&apos;s company and no default template is
                    active. Export is unavailable until a template is assigned.
                </p>
            </div>
        );
    }

    const doc = toViewerDoc(design);
    if (doc === null) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/20 p-10 text-center">
                <p className="text-sm font-bold text-foreground">This ID template could not be rendered</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                    The template data is damaged. Export is disabled.
                </p>
            </div>
        );
    }

    const values = buildIdViewerValues(resolve.user, resolve.company);
    const firstName = values.user_fname ?? "";
    const lastName = values.user_lname ?? "";
    const busy = exporting !== null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Template
                </span>
                <Select
                    disabled={templates.length === 0}
                    onValueChange={setOverrideId}
                    value={overrideId}
                >
                    <SelectTrigger className="h-10 w-full rounded-xl sm:w-[280px]">
                        <SelectValue placeholder="Resolved template" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="auto">Resolved template</SelectItem>
                        {templates.map((template) => (
                            <SelectItem key={String(template.id)} value={String(template.id)}>
                                {template.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col items-start justify-center gap-8 py-6 lg:flex-row">
                <div className="flex flex-col items-center gap-4">
                    <div className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Front
                    </div>
                    <div className="max-w-full overflow-x-auto rounded-xl shadow-lg">
                        <IdViewerSide
                            innerRef={frontRef}
                            nodes={doc.nodes}
                            page={doc.front}
                            values={values}
                        />
                    </div>
                    <Button
                        className="h-11 w-[200px] gap-2 rounded-xl"
                        disabled={busy}
                        onClick={() => void exportSide("front", firstName, lastName)}
                        variant="outline"
                    >
                        <Download className="h-4 w-4" />
                        Export Front
                    </Button>
                </div>
                <div className="flex flex-col items-center gap-4">
                    <div className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Back
                    </div>
                    <div className="max-w-full overflow-x-auto rounded-xl shadow-lg">
                        <IdViewerSide
                            innerRef={backRef}
                            nodes={doc.nodes}
                            page={doc.back}
                            values={values}
                        />
                    </div>
                    <Button
                        className="h-11 w-[200px] gap-2 rounded-xl"
                        disabled={busy}
                        onClick={() => void exportSide("back", firstName, lastName)}
                        variant="outline"
                    >
                        <Download className="h-4 w-4" />
                        Export Back
                    </Button>
                </div>
            </div>
        </div>
    );
}
