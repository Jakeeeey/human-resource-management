"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Minus, X } from "lucide-react";
import "react-quill-new/dist/quill.snow.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { mailOutboxStatusSchema, type MailOutboxStatus } from "../types/mail-outbox.schema";
import { useMailOutbox } from "../hooks/useMailOutbox";
import { useMailTemplates } from "../hooks/useMailTemplates";
import type { MailOutboxRow } from "../providers/mailOutboxService";
import { renderMailTemplate } from "../utils/mailRenderer";
import { MailCombobox } from "./MailCombobox";

const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    ...mailOutboxStatusSchema.options.map((status) => ({ value: status, label: status })),
];

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
 * Relative sent-at label with the absolute value kept in `title`.
 * @param value - The raw sent_at string (or null).
 * @returns A short relative label, or the raw value when unparseable.
 */
function formatRelativeTime(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) return "—";
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return String(value);
    const diff = Date.now() - time;
    if (diff < 0) return String(value);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return String(value);
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
export function MailOutboxViewer() {
    const { rows, loading, error, status, setStatus, refresh } = useMailOutbox();

    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [refresh]);
    const { templates } = useMailTemplates();
    const [templateFilter, setTemplateFilter] = useState("");
    const [query, setQuery] = useState("");
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

    const templateOptions = useMemo(
        () => [
            { value: "", label: "All templates" },
            ...templates.map((template) => ({
                value: String(template.id),
                label: template.template_name,
            })),
        ],
        [templates],
    );

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
            <div className="sticky top-0 z-10 grid gap-2 bg-background pb-2 sm:grid-cols-3">
                <div className="grid gap-2">
                    <Label>Status filter</Label>
                    <MailCombobox
                        options={STATUS_OPTIONS}
                        value={status}
                        onValueChange={(v) => setStatus(v as MailOutboxStatus | "")}
                        placeholder="All statuses"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Template filter</Label>
                    <MailCombobox
                        options={templateOptions}
                        value={templateFilter}
                        onValueChange={setTemplateFilter}
                        placeholder="All templates"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="outbox-recipient-search">Search recipient</Label>
                    <Input
                        id="outbox-recipient-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Recipient or template…"
                    />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "row" : "rows"}
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
                <div
                    role="listbox"
                    aria-label="Outbox rows"
                    className="grid max-h-[560px] content-start gap-2 overflow-y-auto pr-1"
                >
                    {rows.length === 0 && (
                        <p className="rounded-xl border border-border/50 bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
                            No outbox rows yet.
                        </p>
                    )}
                    {rows.length > 0 && filtered.length === 0 && (
                        <p className="rounded-xl border border-border/50 bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
                            No rows match these filters.
                        </p>
                    )}
                    {filtered.map((row, index) => {
                        const isActive = activeRow === row;
                        const templateName = templateNameFor(row);
                        return (
                            <button
                                key={`${String(row.idempotency_key)}-${index}`}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelect(row)}
                                className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left shadow-sm ${
                                    isActive
                                        ? "border-primary/30 bg-primary/5"
                                        : "border-border/50 bg-card hover:bg-muted/40"
                                }`}
                            >
                                <span className="mt-0.5 shrink-0">
                                    <StatusIcon status={row.status} />
                                </span>
                                <span className="grid min-w-0 flex-1 gap-0.5">
                                    <span className="truncate text-sm font-medium" title={row.to_email}>
                                        {row.to_email}
                                    </span>
                                    <span
                                        className="truncate text-xs text-muted-foreground"
                                        title={templateName}
                                    >
                                        {templateName}
                                    </span>
                                    <span
                                        className="truncate text-xs text-muted-foreground"
                                        title={String(row.sent_at ?? "")}
                                    >
                                        {formatRelativeTime(row.sent_at)}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="hidden lg:block">
                    <div className="grid gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
                        {!activeRow ? (
                            <p className="text-sm text-muted-foreground">Select a row to preview.</p>
                        ) : (
                            <>
                                <p className="truncate text-sm font-medium" title={outboxRowTitle(activeRow, linkedFor(activeRow))}>
                                    {outboxRowTitle(activeRow, linkedFor(activeRow))}
                                </p>
                                <MailOutboxDetailWarnings row={activeRow} />
                                <MailOutboxDetailContent
                                    row={activeRow}
                                    linked={linkedFor(activeRow)}
                                    hasTemplateLink={
                                        activeRow.template_id !== null &&
                                        activeRow.template_id !== undefined
                                    }
                                />
                                <MailOutboxDetailMeta row={activeRow} />
                            </>
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
 * Read-only detail extras shown inline in the lg preview pane: persisted
 * warnings plus the send error when the row carries one.
 */
function MailOutboxDetailWarnings({ row }: { row: MailOutboxRow }) {
    const warnings = Array.isArray(row.warnings) ? row.warnings : [];
    if (warnings.length === 0 && !row.error) return null;
    return (
        <div className="grid gap-1.5">
            {warnings.length > 0 && (
                <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">Warnings</p>
                    <p className="break-words text-sm" title={warnings.join(", ")}>
                        {warnings.join(", ")}
                    </p>
                </div>
            )}
            {row.error && (
                <div className="grid gap-1.5">
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="break-words text-sm text-destructive" title={String(row.error)}>
                        {String(row.error)}
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Footer meta shared by the inline preview and the dialog fallback:
 * status badge + sent-at + idempotency key.
 */
function MailOutboxDetailMeta({ row }: { row: MailOutboxRow }) {
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
                variant={String(row.status) === "failed" ? "destructive" : "outline"}
                className={
                    String(row.status) === "failed"
                        ? undefined
                        : String(row.status) === "sent"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-border bg-muted text-muted-foreground"
                }
            >
                {String(row.status ?? "—")}
            </Badge>
            <span className="max-w-40 truncate" title={String(row.sent_at ?? "")}>
                {String(row.sent_at ?? "—")}
            </span>
            <span className="max-w-40 truncate" title={String(row.idempotency_key ?? "")}>
                {String(row.idempotency_key ?? "—")}
            </span>
        </span>
    );
}

/**
 * Read-only sent-mail body: snapshot subject/body when the row carries
 * todo-21 snapshots, otherwise the currently linked template rendered with
 * blank sample vars under an explicit may-have-changed note (pre-snapshot
 * rows), or a no-link empty state. Snapshot HTML renders as-is in a
 * theme-aware card — it is the sender's own rendered content, passed through
 * verbatim (post-scrub HTML carries no classes/inline styles, so it inherits
 * the card foreground in both modes). Shared by the inline preview and the
 * below-lg dialog fallback so both show identical content.
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
        <div className="grid gap-3">
            {hasFallback && (
                <p className="text-xs text-muted-foreground">{SNAPSHOT_UNAVAILABLE_NOTE}</p>
            )}
            <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">Subject</p>
                <p
                    className="truncate text-sm font-medium"
                    title={subject ? subject : undefined}
                >
                    {subject || "—"}
                </p>
            </div>
            <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">Body</p>
                {html ? (
                    <div className="px-1 py-2">
                        <div className="ql-container ql-snow">
                            <div
                                className="ql-editor"
                                contentEditable={false}
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {isSnapshot ? "No body recorded." : "Nothing to preview yet."}
                    </p>
                )}
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
                        <div className="grid gap-3">
                            <MailOutboxDetailWarnings row={row} />
                            <MailOutboxDetailContent
                                row={row}
                                linked={linked}
                                hasTemplateLink={hasTemplateLink}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center">
                    {row && (
                        <span className="sm:mr-auto">
                            <MailOutboxDetailMeta row={row} />
                        </span>
                    )}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
