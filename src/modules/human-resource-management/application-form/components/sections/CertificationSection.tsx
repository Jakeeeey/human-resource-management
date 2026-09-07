"use client";

import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    CERTIFICATION_AGREEMENT_LINE,
    CERTIFICATION_CLAUSES,
    CERTIFICATION_HEADING,
    type ApplicationFormValues,
} from "../../types";
import { SignaturePad, type SignaturePadHandle } from "../SignaturePad";

export function CertificationSection({
    form,
    sigRef,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    sigRef: RefObject<SignaturePadHandle | null>;
}) {
    const signatureTypedName = useWatch({ control: form.control, name: "signature_typed_name" });

    return (
        <div className="space-y-4">
            <Separator />

            <FormField
                control={form.control}
                name="certification_agreed"
                render={({ field }) => (
                    <FormItem className="space-y-3 rounded-lg border p-4">
                        <FormLabel>9. {CERTIFICATION_HEADING}</FormLabel>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            {CERTIFICATION_CLAUSES.map((clause, i) => (
                                <p key={i}>{clause}</p>
                            ))}
                        </div>
                        <div className="flex items-start gap-2 pt-1">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(v) => {
                                        form.clearErrors("certification_agreed");
                                        field.onChange(v === true);
                                    }}
                                />
                            </FormControl>
                            <span className="text-sm">{CERTIFICATION_AGREEMENT_LINE}</span>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />

            <FormField
                control={form.control}
                name="signature_typed_mode"
                render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel>Signature</FormLabel>
                        <SignaturePad
                            ref={sigRef}
                            typedMode={field.value}
                            onTypedModeChange={(t) => {
                                form.clearErrors(["signature_typed_name"]);
                                field.onChange(t);
                            }}
                            typedName={signatureTypedName}
                            onTypedNameChange={(n) => form.setValue("signature_typed_name", n)}
                        />
                        {form.formState.errors.signature_typed_name && (
                            <p className="text-sm font-medium text-destructive">
                                {form.formState.errors.signature_typed_name.message}
                            </p>
                        )}
                    </FormItem>
                )}
            />
        </div>
    );
}
