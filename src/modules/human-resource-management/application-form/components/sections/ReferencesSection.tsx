"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EMPTY_REFERENCE, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

export function ReferencesSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "references" });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">7. Professional / Business References</h2>

            <RepeatingFieldArray
                title="References"
                addLabel="Add Reference"
                fields={fields}
                onAdd={() => append({ ...EMPTY_REFERENCE })}
                onRemove={remove}
                emptyHint="No references added yet (family members should not be listed as references)."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`references.${index}.name`}
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
                            name={`references.${index}.title_occupation`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title / Occupation</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`references.${index}.company_name_address`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Name / Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`references.${index}.contact_number`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contact Number</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </>
                )}
            />
        </div>
    );
}
