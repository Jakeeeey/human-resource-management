"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPTY_LICENSURE_EXAM, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";
import { checkPastDate } from "../../lib/softValidation";
import { maskDecimal } from "../../lib/hardValidation";
import { phToday } from "@/modules/human-resource-management/shared/utils/time";

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
                            rules={{
                                validate: (v) => {
                                    const exam = form.getValues(
                                        `licensure_exams.${index}.examination`
                                    );
                                    if (!exam?.trim()) return true;
                                    return checkPastDate(v ?? "", "Date taken") ?? true;
                                },
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date Taken</FormLabel>
                                    <FormControl>
                                        <Input type="date" max={phToday()} {...field} />
                                    </FormControl>
                                    <FormMessage />
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
                                        <Input
                                            inputMode="decimal"
                                            placeholder="e.g. 85.5"
                                            {...field}
                                            onChange={(e) => field.onChange(maskDecimal(e.target.value))}
                                        />
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Passed">Passed</SelectItem>
                                            <SelectItem value="Failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </>
                )}
            />
        </div>
    );
}
