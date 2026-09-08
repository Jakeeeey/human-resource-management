"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const { templates, loading, error, refresh, saveTemplate } = useMailTemplates();

    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [refresh]);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

    const openEdit = (row: MailTemplateRow) => {
        router.push(`/hrm/mailing/templates/${String(row.id)}`);
    };

    // Duplicate posts a full copy through the existing templates POST route
    // (saveTemplate without an id = create + list refresh). The key stays
    // unique by checking the loaded list: {key}-copy, then -copy-2…-copy-N.
    const duplicateTemplate = async (row: MailTemplateRow) => {
        if (duplicatingId !== null) return;
        const taken = new Set(templates.map((item) => item.template_key));
        let candidate = `${row.template_key}-copy`;
        let attempt = 1;
        while (taken.has(candidate) && attempt < 100) {
            attempt += 1;
            candidate = `${row.template_key}-copy-${attempt}`;
        }
        if (taken.has(candidate)) {
            toast.error("Could not find a unique key for the copy. Please try again.");
            return;
        }
        const copyName = `Copy of ${row.template_name}`;
        setDuplicatingId(String(row.id));
        try {
            const result = await saveTemplate({
                template_key: candidate,
                template_name: copyName,
                subject: row.subject,
                body_html: row.body_html,
                body_text: row.body_text,
                is_active: row.is_active,
            });
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(`Duplicated as "${copyName}".`);
        } finally {
            setDuplicatingId(null);
        }
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
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label={`Template actions for ${row.template_name}`}
                                                title={`Template actions for ${row.template_name}`}
                                                disabled={duplicatingId === String(row.id)}
                                            >
                                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => openEdit(row)}>
                                                <Pencil aria-hidden="true" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() => void duplicateTemplate(row)}
                                                disabled={duplicatingId !== null}
                                            >
                                                <Copy aria-hidden="true" />
                                                {duplicatingId === String(row.id) ? "Duplicating…" : "Duplicate"}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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
