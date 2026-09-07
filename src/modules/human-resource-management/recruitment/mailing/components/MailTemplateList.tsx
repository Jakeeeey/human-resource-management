"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useMailTemplates } from "../hooks/useMailTemplates";
import type { MailTemplateRow } from "../providers/mailTemplateService";

/**
 * Template list with dedicated-page create/edit navigation.
 * @returns The template table.
 */
export function MailTemplateList() {
    const router = useRouter();
    const { templates, loading, error, refresh } = useMailTemplates();

    const openCreate = () => {
        router.push("/hrm/mailing/templates/new");
    };

    const openEdit = (row: MailTemplateRow) => {
        router.push(`/hrm/mailing/templates/${String(row.id)}`);
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-40" />
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:px-1 sm:py-1">
                <p className="text-sm text-muted-foreground" title={`${templates.length} templates`}>
                    {templates.length} template{templates.length === 1 ? "" : "s"}
                </p>
                <Button className="w-full sm:w-auto" onClick={openCreate}>
                    New template
                </Button>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="max-w-40">Key</TableHead>
                            <TableHead className="max-w-56">Name</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="w-40 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                    No templates yet. Create the first one.
                                </TableCell>
                            </TableRow>
                        )}
                        {templates.map((row) => (
                            <TableRow key={String(row.id)}>
                                <TableCell className="max-w-40 truncate" title={row.template_key}>
                                    {row.template_key}
                                </TableCell>
                                <TableCell className="max-w-56 truncate" title={row.template_name}>
                                    {row.template_name}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={
                                            row.is_active
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                : "border-border bg-muted text-muted-foreground"
                                        }
                                    >
                                        {row.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                        Edit
                                    </Button>
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
