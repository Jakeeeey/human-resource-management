"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Minus, X } from "lucide-react";
import "react-quill-new/dist/quill.snow.css";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import type { MailOutboxStatus } from "../types/mail-outbox.schema";
import { useMailOutbox } from "../hooks/useMailOutbox";
import type { MailOutboxRow } from "../providers/mailOutboxService";
import { renderMailTemplate } from "../utils/mailRenderer";

const SNAPSHOT_UNAVAILABLE_NOTE =
    "Template may have changed since send — snapshot unavailable for rows written before snapshots existed";

/**
 * Matches "(min-width: 1024px)" so row taps below lg open the dialog
 * fallback while lg+ drives the inline preview. SSR-safe: false until
 * the effect runs client-side.
 * @returns Whether the viewport is at least lg.
 */
function useIsLargeScreen() {
    const [large, setLarge] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(min-width: 1024px)");
        const update = () => setLarge(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    return large;
}

/**
 * Wireframe timestamp: "Jun 23, 2023 AM" style with the raw value in `title`.
 * @param value - The raw sent_at string (or null).
 * @returns The formatted timestamp, or "—" when missing/unparseable.
 */
function formatOutboxTimestamp(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${day} ${date.getHours() < 12 ? "AM" : "PM"}`;
}

/**
 * Wireframe-correct status mark: icon + color, not a pill. Sent reads as
 * a green check, failed as a red X, everything else neutral.
 * @param status - The outbox row status.
 * @returns The status icon.
 */
function StatusIcon({ status }: { status: MailOutboxRow["status"] }) {
    const value = String(status);
    if (value === "sent") {
        return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Sent" />;
    }
    if (value === "failed") {
        return <X className="h-4 w-4 text-destructive" aria-label="Failed" />;
    }
    if (value === "skipped") {
        return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Skipped" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" aria-label={value} />;
}

/**
 * Dialog title derivation shared by the dialog fallback and the inline
 * preview header: snapshot subject wins, then template name.
 */
function outboxRowTitle(row: MailOutboxRow, linked: LinkedTemplate | null): string {
    if (row.rendered_subject !== null && row.rendered_subject.length > 0) {
        return row.rendered_subject;
    }
    return linked?.name ?? "Outbox row";
}

/**
 * Status-only outbox viewer over the todo-7 routes, restructured from a
 * table + View dialog into a master-detail split: filter bar on top, then
 * a clickable list (left ~45%) with a persistent preview (right ~55%).
 * Rows arrive masked — this viewer never unmasks and offers no
 * resend/retry (D17).
 * @returns The filter bar + master-detail split (+ dialog below lg).
 */
interface MailOutboxViewerProps {
    status: MailOutboxStatus | "";
    templateFilter: string;
    query: string;
    templates: { id: unknown; template_name: string; subject: string; body_html: string }[];
}

export function MailOutboxViewer({ status, templateFilter, query, templates }: MailOutboxViewerProps) {
    const { rows, loading, error, refresh } = useMailOutbox(status);

    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [refresh]);
    const [selected, setSelected] = useState<MailOutboxRow | null>(null);
    const [dialogRow, setDialogRow] = useState<MailOutboxRow | null>(null);
    const isLarge = useIsLargeScreen();

    const templateById = useMemo(() => {
        const map = new Map<string, { name: string; subject: string; body: string }>();
        for (const template of templates) {
            map.set(String(template.id), {
                name: template.template_name,
                subject: template.subject,
                body: template.body_html,
            });
        }
        return map;
    }, [templates]);

    const linkedFor = (row: MailOutboxRow): LinkedTemplate | null => {
        if (row.template_id === null || row.template_id === undefined) return null;
        return templateById.get(String(row.template_id)) ?? null;
    };

    const templateNameFor = (row: MailOutboxRow): string => linkedFor(row)?.name ?? "—";

    // Client-side over the loaded rows only (no new API params): template
    // match AND recipient/template-name substring match, case-insensitive.
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rows.filter((row) => {
            const templateName = templateNameFor(row);
            if (templateFilter !== "") {
                const rowTemplateId =
                    row.template_id === null || row.template_id === undefined
                        ? ""
                        : String(row.template_id);
                if (rowTemplateId !== templateFilter) return false;
            }
            if (needle !== "") {
                const haystack = `${row.to_email} ${templateName}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, templateFilter, query, templateById]);

    // Selection defaults to the first visible row; a stale pick outside the
    // current filter falls back to the first row.
    const activeRow = selected !== null && filtered.includes(selected) ? selected : (filtered[0] ?? null);

    const handleSelect = (row: MailOutboxRow) => {
        setSelected(row);
        if (!isLarge) setDialogRow(row);
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="grid gap-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => void refresh()}>
                    Refresh
                </Button>
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
                    <div className="max-h-[560px] overflow-auto">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-16">Status</TableHead>
                                <TableHead className="max-w-48">Recipient</TableHead>
                                <TableHead className="max-w-56">Template Used</TableHead>
                                <TableHead className="max-w-40">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                        No outbox rows yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.length > 0 && filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                        No rows match these filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered.map((row, index) => {
                                const isActive = activeRow === row;
                                const templateName = templateNameFor(row);
                                const linked = linkedFor(row);
                                const secondLine =
                                    linked && linked.subject.length > 0
                                        ? linked.subject
                                        : String(row.event_key ?? "—");
                                return (
                                    <TableRow
                                        key={`${String(row.idempotency_key)}-${index}`}
                                        aria-selected={isActive}
                                        tabIndex={0}
                                        onClick={() => handleSelect(row)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                handleSelect(row);
                                            }
                                        }}
                                        className={`cursor-pointer ${isActive ? "border-primary/30 bg-primary/5 hover:bg-primary/10" : ""}`}
                                    >
                                        <TableCell>
                                            <StatusIcon status={row.status} />
                                        </TableCell>
                                        <TableCell className="max-w-48 truncate" title={row.to_email}>
                                            {row.to_email}
                                        </TableCell>
                                        <TableCell className="max-w-56">
                                            <p className="truncate text-sm font-medium" title={templateName}>
                                                {templateName}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground" title={secondLine}>
                                                {secondLine}
                                            </p>
                                        </TableCell>
                                        <TableCell className="max-w-40 truncate" title={String(row.sent_at ?? "")}>
                                            {formatOutboxTimestamp(row.sent_at)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    </div>
                </div>
                <div className="hidden lg:block">
                    <div className="grid gap-2">
                        {!activeRow ? (
                            <p className="text-sm text-muted-foreground">Select a row to preview.</p>
                        ) : (
                            <MailOutboxDetailContent
                                row={activeRow}
                                linked={linkedFor(activeRow)}
                                hasTemplateLink={
                                    activeRow.template_id !== null &&
                                    activeRow.template_id !== undefined
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
            <MailOutboxViewDialog
                row={dialogRow}
                linked={dialogRow ? linkedFor(dialogRow) : null}
                hasTemplateLink={dialogRow?.template_id !== null && dialogRow?.template_id !== undefined}
                onClose={() => setDialogRow(null)}
            />
        </div>
    );
}

interface LinkedTemplate {
    name: string;
    subject: string;
    body: string;
}

/**
 * Read-only sent-mail body: snapshot subject/body when the row carries
 * todo-21 snapshots, otherwise the currently linked template rendered with
 * blank sample vars under an explicit may-have-changed note (pre-snapshot
 * rows), or a no-link empty state. The email renders in a WHITE card —
 * light-world email canvas per the wireframe, deliberately not themed —
 * with Quill typography and no editor instance. Shared by the inline
 * preview and the below-lg dialog fallback so both show identical content.
 */
function MailOutboxDetailContent({
    row,
    linked,
    hasTemplateLink,
}: {
    row: MailOutboxRow;
    linked: LinkedTemplate | null;
    hasTemplateLink: boolean;
}) {
    const fallback = useMemo(() => {
        if (row.rendered_subject !== null || row.rendered_body_html !== null || !linked) {
            return null;
        }
        return {
            subject: renderMailTemplate(linked.subject, {}).text,
            body: renderMailTemplate(linked.body, {}).text,
        };
    }, [row, linked]);

    // Single-wrapper skin (Todo-24): snapshot or template-fallback whichever
    // produced HTML feeds ONE snow container — same strings in, Quill
    // typography out. No editor instance: read-only skin only.
    const isSnapshot = row.rendered_subject !== null || row.rendered_body_html !== null;
    const hasFallback = !isSnapshot && !!linked && !!fallback;
    const subject = isSnapshot ? row.rendered_subject : (fallback?.subject ?? null);
    const html = isSnapshot ? row.rendered_body_html : (fallback?.body ?? null);

    if (!isSnapshot && !hasFallback) {
        return (
            <p className="text-sm text-muted-foreground">
                {hasTemplateLink ? SNAPSHOT_UNAVAILABLE_NOTE : "No template linked"}
            </p>
        );
    }

    return (
        <div className="grid gap-2">
            {hasFallback && (
                <p className="text-xs text-muted-foreground">{SNAPSHOT_UNAVAILABLE_NOTE}</p>
            )}
            <div className="rounded-xl bg-muted/50 p-3 sm:p-4">
                <p className="truncate text-lg font-bold" title={subject ? subject : undefined}>
                    {subject || "—"}
                </p>
                <div className="mt-2 rounded-lg bg-muted p-4 text-sm leading-relaxed">
                    {html ? (
                        <div className="ql-container ql-snow">
                            <div
                                className="ql-editor"
                                contentEditable={false}
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        </div>
                    ) : (
                        <p>{isSnapshot ? "No body recorded." : "Nothing to preview yet."}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Below-lg fallback: the same detail content in the existing dialog shell.
 * On lg+ the split preview covers selection, so this only opens from row
 * taps on smaller viewports.
 */
function MailOutboxViewDialog({
    row,
    linked,
    hasTemplateLink,
    onClose,
}: {
    row: MailOutboxRow | null;
    linked: LinkedTemplate | null;
    hasTemplateLink: boolean;
    onClose: () => void;
}) {
    const open = row !== null;
    const title = !row ? "Outbox row" : outboxRowTitle(row, linked);

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="w-[95vw] sm:max-w-[760px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="truncate" title={title}>
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
                    {!row ? null : (
                        <MailOutboxDetailContent
                            row={row}
                            linked={linked}
                            hasTemplateLink={hasTemplateLink}
                        />
                    )}
                </div>
                <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
