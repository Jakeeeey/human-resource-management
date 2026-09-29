"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { mailVarAllowlist } from "../types/mail-template.schema";
import { mailHtmlToText } from "../utils/mailText";
import { scrubClientHtml } from "../utils/mailScrub";
import { useMailTemplates } from "../hooks/useMailTemplates";
import { useMailTemplateForm } from "../hooks/useMailTemplateForm";
import {
    MailConfirmDialog,
    MailConfirmDialogAction,
    MailConfirmDialogCancel,
    MailConfirmDialogContent,
    MailConfirmDialogDescription,
    MailConfirmDialogFooter,
    MailConfirmDialogHeader,
    MailConfirmDialogTitle,
} from "./MailConfirmDialog";
import { MailTemplateEditor, mailEditorHtmlToStoredTokens, toFriendlyMailVarName } from "./MailTemplateEditor";
import type { MailTemplateEditorHandle } from "./MailTemplateEditor";
import { MailOutcomeBadge } from "./MailOutcomeBadge";

interface MailTemplatePageProps {
    mode: "create" | "edit";
    templateId?: string;
}

/**
 * Full-page template editor (replaces the cramped MailTemplateDialog).
 * Create vs edit by param; save/scrub/preview/dry-run behavior identical.
 * @param mode - Create or edit flow.
 * @param templateId - Row id in edit mode.
 * @returns The template page.
 */
export function MailTemplatePage({ mode, templateId }: MailTemplatePageProps) {
    const router = useRouter();
    const { templates, loading, saving, saveTemplate } = useMailTemplates();

    const isCreate = mode === "create";
    const template =
        isCreate
            ? null
            : (templates.find((row) => String(row.id) === String(templateId ?? "")) ?? null);

    const editorRef = useRef<MailTemplateEditorHandle | null>(null);
    const [backConfirmOpen, setBackConfirmOpen] = useState(false);

    const form = useMailTemplateForm({
        template,
        saving,
        editorRef,
        onSave: async (input, id) => {
            const targetId = id ?? template?.id;
            const result = await saveTemplate(input, targetId ?? undefined);
            if (!result.ok) return { ok: false, message: result.message };
            return { ok: true };
        },
    });

    const normalizedTemplateBody = (html: string): string => {
        const tokens = mailEditorHtmlToStoredTokens(html);
        try {
            return scrubClientHtml(tokens);
        } catch {
            return tokens;
        }
    };

    const goBack = () => router.push("/hrm/mailing");

    const requestBack = () => {
        const cleanBody = editorRef.current?.getCleanHtml() ?? form.bodyHtml;
        const dirty = isCreate
            ? form.templateKey.trim() !== "" ||
              form.templateName.trim() !== "" ||
              form.subject.trim() !== "" ||
              mailHtmlToText(normalizedTemplateBody(cleanBody)).trim() !== "" ||
              !form.isActive
            : form.templateKey !== (template?.template_key ?? "") ||
              form.templateName !== (template?.template_name ?? "") ||
              form.subject !== (template?.subject ?? "") ||
              normalizedTemplateBody(cleanBody) !==
                  normalizedTemplateBody(template?.body_html ?? "") ||
              form.isActive !== (template?.is_active ?? true);
        if (dirty) setBackConfirmOpen(true);
        else goBack();
    };

    const handleSaveAndBack = async () => {
        const saved = await form.handleSave();
        if (saved) goBack();
    };

    if (!isCreate && loading) {
        return (
            <div className="mx-auto grid w-full max-w-[1200px] gap-4 p-2 sm:p-6 md:p-10">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!isCreate && !template) {
        return (
            <div className="mx-auto grid w-full max-w-[1200px] gap-4 p-2 sm:p-6 md:p-10">
                <Button variant="ghost" className="w-full sm:w-auto justify-start" onClick={requestBack}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to templates
                </Button>
                <Card className="overflow-hidden rounded-lg border bg-card shadow-none">
                    <CardContent className="grid gap-2 p-4 text-center sm:p-6">
                        <p className="text-sm font-medium">Template not found.</p>
                        <p className="text-sm text-muted-foreground">
                            It may have been deleted. Return to the list and pick another template.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-0 w-full">
            {/* Sticky action bar: negative top offset + negative top margin pull
                it over main's top padding so no padding strip shows when stuck. */}
            <div className="sticky -top-6 z-30 -mt-6 w-full border-b bg-background">
                <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-2 py-2 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={requestBack}
                            disabled={form.busy}
                            aria-label="Back to templates"
                            className="shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Back</span>
                        </Button>
                        <div className="grid min-w-0 gap-0.5">
                            <h1 className="truncate text-lg font-semibold sm:text-2xl">
                                {isCreate ? "New template" : "Edit template"}
                            </h1>
                            <p className="truncate text-xs text-muted-foreground sm:text-sm">
                                {isCreate
                                    ? "Compose the subject and body with {{var}} placeholders."
                                    : (template?.template_name ?? "Update the subject and body.")}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="mail-template-page-active"
                                checked={form.isActive}
                                onCheckedChange={form.setIsActive}
                                disabled={form.busy}
                            />
                            <Label htmlFor="mail-template-page-active" className="text-xs font-medium text-muted-foreground">Active</Label>
                            {form.dryRunReady && (
                                <MailOutcomeBadge status="dry_run" label="Dry-run recorded — see Outbox" className="max-w-full" />
                            )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={form.busy}
                                onClick={() => void form.handleDryRunTestSend()}
                                className="min-h-11 w-full sm:w-auto md:min-h-0"
                            >
                                {form.testing ? "Saving…" : "Save + dry-run test-send"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={form.busy}
                                onClick={() => void handleSaveAndBack()}
                                className="min-h-11 w-full sm:w-auto md:min-h-0"
                            >
                                {saving ? "Saving…" : "Save template"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content: constrained form column + wider preview rail. */}
            <div className="mx-auto grid w-full max-w-[1200px] gap-6 p-4 sm:p-6 md:p-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="mx-auto grid w-full min-w-0 max-w-3xl gap-6 lg:mx-0">
                    <Card className="overflow-hidden rounded-lg border bg-card shadow-none">
                        <CardHeader className="flex h-11 flex-row items-center border-b px-4">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                Details
                            </span>
                        </CardHeader>
                        <CardContent className="grid gap-4 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor="mail-template-page-key" className="text-xs font-medium text-muted-foreground">Template key <span className="text-destructive" aria-hidden="true">*</span></Label>
                                    <Input
                                        id="mail-template-page-key"
                                        value={form.templateKey}
                                        onChange={(e) => form.setTemplateKey(e.target.value)}
                                        placeholder="e.g. initial graded pass"
                                        disabled={form.busy}
                                        aria-invalid={form.fieldErrors.templateKey !== null}
                                        className="h-8 text-xs"
                                    />
                                    {form.fieldErrors.templateKey && (
                                        <p className="text-xs text-destructive" role="alert">
                                            {form.fieldErrors.templateKey}
                                        </p>
                                    )}
                                </div>
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor="mail-template-page-name" className="text-xs font-medium text-muted-foreground">Template name <span className="text-destructive" aria-hidden="true">*</span></Label>
                                    <Input
                                        id="mail-template-page-name"
                                        value={form.templateName}
                                        onChange={(e) => form.setTemplateName(e.target.value)}
                                        placeholder="e.g. Initial interview — passed"
                                        disabled={form.busy}
                                        aria-invalid={form.fieldErrors.templateName !== null}
                                        className="h-8 text-xs"
                                    />
                                    {form.fieldErrors.templateName && (
                                        <p className="text-xs text-destructive" role="alert">
                                            {form.fieldErrors.templateName}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid min-w-0 gap-2">
                                <Label htmlFor="mail-template-page-subject" className="text-xs font-medium text-muted-foreground">Subject <span className="text-destructive" aria-hidden="true">*</span></Label>
                                <Input
                                    id="mail-template-page-subject"
                                    value={form.subject}
                                    onChange={(e) => form.setSubject(e.target.value)}
                                    placeholder="e.g. Your interview result"
                                    disabled={form.busy}
                                    aria-invalid={form.fieldErrors.subject !== null}
                                    className="h-8 text-xs"
                                />
                                {form.fieldErrors.subject && (
                                    <p className="text-xs text-destructive" role="alert">
                                        {form.fieldErrors.subject}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden rounded-lg border bg-card shadow-none">
                        <CardHeader className="flex h-11 flex-row items-center border-b px-4">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                Body
                            </span>
                        </CardHeader>
                        <CardContent className="grid gap-4 p-4">
                            <div
                                className="flex max-h-[560px] min-h-[320px] min-w-0 flex-col gap-2"
                            >
                                <MailTemplateEditor
                                    ref={editorRef}
                                    value={form.bodyHtml}
                                    onChange={form.setBodyHtml}
                                />
                                {form.fieldErrors.body && (
                                    <p className="text-xs text-destructive" role="alert">
                                        {form.fieldErrors.body}
                                    </p>
                                )}
                            </div>
                            <div className="grid min-w-0 gap-2">
                                <Label className="text-xs font-medium text-muted-foreground">Fields</Label>
                                <p className="text-xs text-muted-foreground">
                                    Click a field to add it to the email
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {mailVarAllowlist.map((name) => (
                                        <Button
                                            key={name}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-6 rounded-full px-2.5 text-xs font-medium transition-colors duration-150"
                                            title={`{{${name}}} — click to insert at cursor`}
                                            disabled={form.busy}
                                            onClick={() => form.insertVar(name)}
                                        >
                                            {toFriendlyMailVarName(name)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid min-w-0 content-start gap-6">
                    <Card className="overflow-hidden rounded-lg border bg-card shadow-none lg:sticky lg:top-24">
                        <CardHeader className="flex h-11 flex-row items-center border-b px-4">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                Preview
                            </span>
                        </CardHeader>
                        <CardContent className="grid min-w-0 gap-3 p-4">
                            {form.preview.warnings.length > 0 && (
                                <div className="flex flex-wrap gap-1.5" role="alert">
                                    {form.preview.warnings.map((warning) => (
                                        <MailOutcomeBadge key={warning} status="warning" label={warning} className="max-w-full" />
                                    ))}
                                </div>
                            )}
                            <div className="truncate text-sm font-semibold" title={form.preview.subjectText || undefined}>
                                {form.preview.subjectText || <span className="text-muted-foreground">No subject.</span>}
                            </div>
                            <div
                                className="min-h-20 min-w-0 max-w-none text-sm wrap-break-word [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: form.preview.bodyText || "<p>No content.</p>" }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
            <MailConfirmDialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
                <MailConfirmDialogContent>
                    <MailConfirmDialogHeader>
                        <MailConfirmDialogTitle>Discard unsaved changes?</MailConfirmDialogTitle>
                        <MailConfirmDialogDescription>
                            Your edits to this template will be lost. Saved templates are unaffected.
                        </MailConfirmDialogDescription>
                    </MailConfirmDialogHeader>
                    <MailConfirmDialogFooter>
                        <MailConfirmDialogCancel>Keep editing</MailConfirmDialogCancel>
                        <MailConfirmDialogAction onClick={goBack}>
                            Discard
                        </MailConfirmDialogAction>
                    </MailConfirmDialogFooter>
                </MailConfirmDialogContent>
            </MailConfirmDialog>
        </div>
    );
}
