"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EMPTY_TRAINING, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";
import { checkDateOrder } from "../../lib/softValidation";

export function TrainingsSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "trainings" });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">8. Trainings / Seminars Attended</h2>

            <RepeatingFieldArray
                title="Trainings"
                addLabel="Add Training"
                fields={fields}
                onAdd={() => append({ ...EMPTY_TRAINING })}
                onRemove={remove}
                emptyHint="No trainings added yet."
                renderRow={(index) => (
                    <>
                        <FormField
                            control={form.control}
                            name={`trainings.${index}.title_subject`}
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Title / Subject</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`trainings.${index}.venue_location`}
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Venue / Location</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`trainings.${index}.date_from`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g. May 2023"
                                            {...field}
                                            onBlur={() => {
                                                field.onBlur();
                                                form.trigger(`trainings.${index}.date_to`);
                                            }}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`trainings.${index}.date_to`}
                            rules={{
                                validate: (v) =>
                                    checkDateOrder(
                                        form.getValues(`trainings.${index}.date_from`) ?? "",
                                        v ?? ""
                                    ) ?? true,
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>To</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
            />
        </div>
    );
}
