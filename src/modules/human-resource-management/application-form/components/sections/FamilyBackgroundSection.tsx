"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DEPENDENT_RELATION_OPTIONS,
    EMPTY_FAMILY_DEPENDENT,
    type ApplicationFormValues,
} from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

function FamilyMemberBlock({
    form,
    base,
    label,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    base: "father" | "mother" | "spouse";
    label: string;
}) {
    return (
        <div className="rounded-lg border p-3">
            <h3 className="mb-3 text-sm font-semibold">{label}</h3>
            <div className="grid gap-3 sm:grid-cols-5">
                <FormField
                    control={form.control}
                    name={`${base}.name`}
                    render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`${base}.age`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Age</FormLabel>
                            <FormControl>
                                <Input type="number" min={0} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`${base}.occupation`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Occupation</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`${base}.company`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}

export function FamilyBackgroundSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const civilStatus = useWatch({ control: form.control, name: "civil_status" });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "family_dependents",
    });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">3. Family Background</h2>

            <div className="space-y-3">
                <FamilyMemberBlock form={form} base="father" label="Father" />
                <FamilyMemberBlock form={form} base="mother" label="Mother" />
                {civilStatus !== "Single" && (
                    <FamilyMemberBlock form={form} base="spouse" label="Spouse" />
                )}
            </div>

            <RepeatingFieldArray
                title="Children / Other Dependents"
                addLabel="Add Dependent"
                fields={fields}
                onAdd={() => append({ ...EMPTY_FAMILY_DEPENDENT })}
                onRemove={remove}
                emptyHint="No children or other dependents added."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`family_dependents.${index}.relation`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Relation</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {DEPENDENT_RELATION_OPTIONS.map((o) => (
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
                            name={`family_dependents.${index}.name`}
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
                            name={`family_dependents.${index}.age`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Age</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`family_dependents.${index}.occupation`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Occupation / School</FormLabel>
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
