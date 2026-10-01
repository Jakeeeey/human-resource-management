"use client";

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationFormValues } from "../../types";

export function SkillsSection({ form }: { form: UseFormReturn<ApplicationFormValues> }) {
    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold">5. Skills / Other Information</h2>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="special_skills"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Special Skills</FormLabel>
                            <FormControl>
                                <Textarea rows={2} {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="languages"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Languages / Dialects Spoken</FormLabel>
                            <FormControl>
                                <Textarea rows={2} {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="organizational_affiliations"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organizational Affiliations</FormLabel>
                            <FormControl>
                                <Textarea rows={2} {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="hobbies_interests"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hobbies / Interests</FormLabel>
                            <FormControl>
                                <Textarea rows={2} {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
