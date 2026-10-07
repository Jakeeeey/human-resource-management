"use client";

import type { UseFormReturn } from "react-hook-form";
import { useRef } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Eye, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ATTACHMENT_TYPE_OPTIONS,
    EMPTY_ATTACHMENT,
    type ApplicationFormValues,
} from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";
import { ATTACHMENTS_FIELD_ID } from "../../lib/fieldIds";
import { ATTACHMENT_ACCEPT, ATTACHMENT_HELP_TEXT, attachmentFileError } from "../../lib/attachmentRules";

function AttachmentFilePicker({
    form,
    index,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    index: number;
}) {
    const file = useWatch({ control: form.control, name: `attachments.${index}.file` });
    const inputRef = useRef<HTMLInputElement | null>(null);

    const pick = (picked: File | undefined) => {
        if (!picked) return;
        const problem = attachmentFileError(picked);
        if (problem) {
            toast.error(problem);
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        form.setValue(`attachments.${index}.file`, picked, { shouldDirty: true });
    };

    const view = () => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const clear = () => {
        form.setValue(`attachments.${index}.file`, null, { shouldDirty: true });
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <FormItem>
            <FormLabel>File</FormLabel>
            <input
                ref={inputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
            />
            {file ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 max-w-full truncate text-sm">{file.name}</span>
                    <Button type="button" size="sm" variant="outline" onClick={view}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={clear}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove file
                    </Button>
                </div>
            ) : (
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                    Choose file
                </Button>
            )}
            <p className="text-xs text-muted-foreground">{ATTACHMENT_HELP_TEXT}</p>
        </FormItem>
    );
}

export function AttachmentsSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "attachments" });

    return (
        <div id={ATTACHMENTS_FIELD_ID} className="space-y-4">
            <h2 className="text-base font-semibold">Attachments</h2>
            <p className="text-xs text-muted-foreground">
                A resume is required. Other documents (transcript, valid ID, certificates) are optional. Choose &ldquo;Resume&rdquo; as the Document Type for your resume.
            </p>

            <RepeatingFieldArray
                title="Documents"
                addLabel="Add Document"
                fields={fields}
                onAdd={() => append({ ...EMPTY_ATTACHMENT, type: "Other" })}
                onRemove={remove}
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`attachments.${index}.type`}
                            rules={{ required: "Select a document type." }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Document Type <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {ATTACHMENT_TYPE_OPTIONS.map((o) => (
                                                <SelectItem key={o} value={o}>
                                                    {o}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`attachments.${index}.label`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Label (optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Diploma" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <AttachmentFilePicker form={form} index={index} />
                    </>
                )}
            />
        </div>
    );
}
