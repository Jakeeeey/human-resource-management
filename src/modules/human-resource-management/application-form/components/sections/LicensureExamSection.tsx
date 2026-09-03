"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EMPTY_LICENSURE_EXAM, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

export function LicensureExamSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "licensure_exams",
    });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">Licensure / Board Exams</h2>

            <RepeatingFieldArray
                title="Exams Taken"
                addLabel="Add Exam"
                fields={fields}
                onAdd={() => append({ ...EMPTY_LICENSURE_EXAM })}
                onRemove={remove}
                emptyHint="No exams added -- leave blank if not applicable."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`licensure_exams.${index}.examination`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Examination</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Civil Service Professional" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`licensure_exams.${index}.date_taken`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date Taken</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. March 2021" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`licensure_exams.${index}.rating`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rating</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`licensure_exams.${index}.result`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Result</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Passed / Failed" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`licensure_exams.${index}.inclusive_dates`}
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Inclusive Dates</FormLabel>
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
