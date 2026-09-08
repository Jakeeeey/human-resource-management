"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
 * Status-only outbox viewer over the todo-7 routes. Rows arrive masked —
 * this viewer never unmasks and offers no resend/retry (D17).
 * @returns The filter + read-only table.
 */
export function MailOutboxViewer() {
    const { rows, loading, error, status, setStatus, refresh } = useMailOutbox();
    const { templates } = useMailTemplates();
    const [selected, setSelected] = useState<MailOutboxRow | null>(null);

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
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            <div className="grid gap-2 sm:max-w-xs">
                <Label>Status filter</Label>
                <MailCombobox
                    options={STATUS_OPTIONS}
                    value={status}
                    onValueChange={(v) => setStatus(v as MailOutboxStatus | "")}
                    placeholder="All statuses"
                />
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <Table className="min-w-[920px]">
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="max-w-44">Recipient</TableHead>
                            <TableHead className="max-w-48">Template</TableHead>
                            <TableHead className="max-w-48">Event</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="max-w-64">Warnings</TableHead>
                            <TableHead className="max-w-32">Sent at</TableHead>
                            <TableHead className="w-16">
                                <span className="sr-only">View</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                                    No outbox rows yet.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row, index) => {
                            const linked = row.template_id === null || row.template_id === undefined
                                ? undefined
                                : templateById.get(String(row.template_id));
                            return (
                            <TableRow key={`${String(row.idempotency_key)}-${index}`}>
                                <TableCell className="max-w-44 truncate" title={row.to_email}>
                                    {row.to_email}
                                </TableCell>
                                <TableCell className="max-w-48 truncate" title={linked?.name ?? ""}>
                                    {linked?.name ?? "—"}
                                </TableCell>
                                <TableCell className="max-w-48 truncate" title={String(row.event_key ?? "")}>
                                    {String(row.event_key ?? "—")}
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell className="max-w-64">
                                    {row.warnings.length === 0 ? (
                                        <span className="text-sm text-muted-foreground">—</span>
                                    ) : (
                                        <span className="block truncate text-sm" title={row.warnings.join(", ")}>
                                            {row.warnings.join(", ")}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-32 truncate" title={String(row.sent_at ?? "")}>
                                    {String(row.sent_at ?? "—")}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label="View sent mail"
                                        onClick={() => setSelected(row)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                </div>
            </div>
            <MailOutboxViewDialog
                row={selected}
                linked={selected && selected.template_id !== null && selected.template_id !== undefined
                    ? templateById.get(String(selected.template_id)) ?? null
                    : null}
                hasTemplateLink={selected?.template_id !== null && selected?.template_id !== undefined}
                onClose={() => setSelected(null)}
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
 * Read-only sent-mail viewer: snapshot subject/body when the row carries
 * todo-21 snapshots, otherwise the currently linked template rendered with
 * blank sample vars under an explicit may-have-changed note (pre-snapshot
 * rows), or a no-link empty state. Snapshot HTML renders as-is in an
 * isolated forced-light card (compose-preview pattern) — it is the sender's
 * own rendered content, passed through verbatim.
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

    const fallback = useMemo(() => {
        if (!row || row.rendered_subject !== null || row.rendered_body_html !== null || !linked) {
            return null;
        }
        return {
            subject: renderMailTemplate(linked.subject, {}).text,
            body: renderMailTemplate(linked.body, {}).text,
        };
    }, [row, linked]);

    const title = !row
        ? "Outbox row"
        : row.rendered_subject !== null && row.rendered_subject.length > 0
          ? row.rendered_subject
          : (linked?.name ?? "Outbox row");

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="w-[95vw] sm:max-w-[760px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="truncate" title={title}>
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
                    {!row ? null : row.rendered_subject !== null || row.rendered_body_html !== null ? (
                        <div className="grid gap-3">
                            <div className="grid gap-1.5">
                                <p className="text-xs text-muted-foreground">Subject</p>
                                <p
                                    className="truncate text-sm font-medium"
                                    title={row.rendered_subject ?? undefined}
                                >
                                    {row.rendered_subject || "—"}
                                </p>
                            </div>
                            <div className="grid gap-1.5">
                                <p className="text-xs text-muted-foreground">Body</p>
                                {row.rendered_body_html ? (
                                    <div
                                        className="rounded-md border border-border p-3 text-sm leading-relaxed"
                                        style={{
                                            colorScheme: "light",
                                            backgroundColor: "#ffffff",
                                            color: "#1b1b1f",
                                        }}
                                        dangerouslySetInnerHTML={{ __html: row.rendered_body_html }}
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">No body recorded.</p>
                                )}
                            </div>
                        </div>
                    ) : linked && fallback ? (
                        <div className="grid gap-3">
                            <p className="text-xs text-muted-foreground">{SNAPSHOT_UNAVAILABLE_NOTE}</p>
                            <div className="grid gap-1.5">
                                <p className="text-xs text-muted-foreground">Subject</p>
                                <p
                                    className="truncate text-sm font-medium"
                                    title={fallback.subject ? fallback.subject : undefined}
                                >
                                    {fallback.subject || "—"}
                                </p>
                            </div>
                            <div className="grid gap-1.5">
                                <p className="text-xs text-muted-foreground">Body</p>
                                {fallback.body ? (
                                    <div
                                        className="rounded-md border border-border p-3 text-sm leading-relaxed"
                                        style={{
                                            colorScheme: "light",
                                            backgroundColor: "#ffffff",
                                            color: "#1b1b1f",
                                        }}
                                        dangerouslySetInnerHTML={{ __html: fallback.body }}
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {hasTemplateLink ? SNAPSHOT_UNAVAILABLE_NOTE : "No template linked"}
                        </p>
                    )}
                </div>
                <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center">
                    {row && (
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:mr-auto">
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
                    )}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
