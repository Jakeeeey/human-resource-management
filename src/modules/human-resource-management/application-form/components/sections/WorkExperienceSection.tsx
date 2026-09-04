"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EMPTY_WORK_EXPERIENCE, type ApplicationFormValues } from "../../types";
import { RepeatingFieldArray } from "../RepeatingFieldArray";

export function WorkExperienceSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    const isFreshGraduate = useWatch({ control: form.control, name: "is_fresh_graduate" });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "work_experience",
    });

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">6. Work Experience</h2>

            <FormField
                control={form.control}
                name="is_fresh_graduate"
                render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel className="!mt-0">
                            I am a fresh graduate / have no prior work experience
                        </FormLabel>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={(v) => {
                                    field.onChange(v);
                                    if (v) remove();
                                }}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            {!isFreshGraduate && (
                <RepeatingFieldArray
                    title="Previous Employers"
                    addLabel="Add Employer"
                    fields={fields}
                    onAdd={() => append({ ...EMPTY_WORK_EXPERIENCE })}
                    onRemove={remove}
                    emptyHint="No work experience added yet."
                    renderRow={(index) => (
                        <>
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.employer`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employer</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.address`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employer Address</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.job_title`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Job Title</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name={`work_experience.${index}.date_from`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>From</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Jan 2022" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`work_experience.${index}.date_to`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>To</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Present" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name={`work_experience.${index}.salary_rate_start`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Starting Salary</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={0} step="0.01" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`work_experience.${index}.salary_rate_end`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ending Salary</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={0} step="0.01" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.supervisor_name`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supervisor Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.supervisor_contact`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supervisor Contact</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.responsibilities`}
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Responsibilities</FormLabel>
                                        <FormControl>
                                            <Textarea rows={2} {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`work_experience.${index}.reason_for_leaving`}
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Reason for Leaving</FormLabel>
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
