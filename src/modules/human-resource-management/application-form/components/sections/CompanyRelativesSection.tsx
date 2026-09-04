"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EMPTY_COMPANY_RELATIVE, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

export function CompanyRelativesSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const hasRelatives = useWatch({ control: form.control, name: "has_company_relatives" });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "company_relatives",
    });

    return (
        <div className="space-y-4">
            <FormField
                control={form.control}
                name="has_company_relatives"
                render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel className="!mt-0">
                            Do you have any relatives currently working at the company?
                        </FormLabel>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={(v) => {
                                    field.onChange(v);
                                    if (!v) remove();
                                }}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            {hasRelatives && (
                <RepeatingFieldArray
                    title="Relatives at the Company"
                    addLabel="Add Relative"
                    fields={fields}
                    onAdd={() => append({ ...EMPTY_COMPANY_RELATIVE })}
                    onRemove={remove}
                    emptyHint="Add at least one relative, or turn the switch above off."
                    renderRow={(index) => (
                        <>
                            <FormField
                                control={form.control}
                                name={`company_relatives.${index}.name`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`company_relatives.${index}.relationship`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Relationship</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Cousin" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`company_relatives.${index}.position`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Their Position</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`company_relatives.${index}.area_assignment`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Area / Branch</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </>
                    )}
                />
            )}
        </div>
    );
}
