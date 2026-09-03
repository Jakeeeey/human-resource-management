"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
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

function AttachmentFilePicker({
    form,
    index,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    index: number;
}) {
    const file = useWatch({ control: form.control, name: `attachments.${index}.file` });

    return (
        <FormItem>
            <FormLabel>File</FormLabel>
            <FormControl>
                <div className="flex items-center gap-2">
                    <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                            form.setValue(`attachments.${index}.file`, e.target.files?.[0] ?? null)
                        }
                    />
                </div>
            </FormControl>
            {file && <p className="truncate text-xs text-muted-foreground">{file.name}</p>}
        </FormItem>
    );
}

export function AttachmentsSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "attachments" });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">Attachments</h2>
            <p className="text-xs text-muted-foreground">
                Please upload your resume. Other documents (transcript, valid ID, certificates) are optional.
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
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Document Type</FormLabel>
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
