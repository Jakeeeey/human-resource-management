"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
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
    EDUCATION_LEVEL_OPTIONS,
    EMPTY_EDUCATION,
    type ApplicationFormValues,
} from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

export function EducationSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "education" });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">4. Educational Background</h2>

            <RepeatingFieldArray
                title="Schools Attended"
                addLabel="Add School"
                fields={fields}
                onAdd={() => append({ ...EMPTY_EDUCATION })}
                onRemove={remove}
                emptyHint="No schools added yet."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`education.${index}.level`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Level</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {EDUCATION_LEVEL_OPTIONS.map((o) => (
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
                            name={`education.${index}.school_name`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>School Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`education.${index}.school_address`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>School Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name={`education.${index}.date_from`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>From</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 2018" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`education.${index}.date_to`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>To</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 2022" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name={`education.${index}.degree_units_earned`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Degree / Units Earned</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`education.${index}.honors_awards`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Honors / Awards</FormLabel>
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
