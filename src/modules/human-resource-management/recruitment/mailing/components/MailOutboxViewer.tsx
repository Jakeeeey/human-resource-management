"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MailCombobox } from "./MailCombobox";

const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    ...mailOutboxStatusSchema.options.map((status) => ({ value: status, label: status })),
];

/**
 * Status-only outbox viewer over the todo-7 routes. Rows arrive masked —
 * this viewer never unmasks and offers no resend/retry (D17).
 * @returns The filter + read-only table.
 */
export function MailOutboxViewer() {
    const { rows, loading, error, status, setStatus, refresh } = useMailOutbox();

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
                <Table className="min-w-[760px]">
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="max-w-44">Recipient</TableHead>
                            <TableHead className="max-w-48">Event</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="max-w-64">Warnings</TableHead>
                            <TableHead className="max-w-32">Sent at</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                    No outbox rows yet.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row, index) => (
                            <TableRow key={`${String(row.idempotency_key)}-${index}`}>
                                <TableCell className="max-w-44 truncate" title={row.to_email}>
                                    {row.to_email}
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            </div>
        </div>
    );
}
